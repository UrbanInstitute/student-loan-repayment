var PREV_BALANCE;
var PREV_DATA = {}
var DOLLARS = d3.format("$,.0f")
var SHORT_DOLLARS = d3.format("$.0s")
var MAX_YEARS = 50;

function IS_MOBILE(){
	return d3.select("#isMobile").style("display") == "block";
}
function IS_PHONE(){
	return d3.select("#isPhone").style("display") == "block";
}

function getGlobals(){
	var globals = {}
	globals.standardYears = 10;
	globals.interestRate = 0.0445;
	globals.standardFee = 0.0;
	globals.incomeIncrease = 0.04;
	globals.povertyLevel = 12060;
	globals.discountRate = 0.03;
	globals.isGraduate = 0;
	globals.inflation = 0.02;

	return globals;
}

function getInputs(){
	var inputs = {}
	inputs.percentFPL = parseFloat($("#percentFPL").val())
	inputs.percentDiscretionaryAGI = parseFloat($("#percentDiscretionaryAGI").val())
	inputs.forgivenessPeriod = parseFloat($("#forgivenessPeriod").val())
	inputs.loanAmount = parseFloat($("#loanAmount").val())
	inputs.capAtStandardRepayment = d3.select("#capAtStandardRepayment").classed("on");
	inputs.excludeIncome = d3.select("#excludeIncome").classed("on");
	inputs.fplIncome = parseFloat($("#fplIncome").val())
	inputs.fplReduction = parseFloat($("#fplReduction").val())
	inputs.minPayment = parseFloat($("#minPayment").val());
	inputs.capAtPercentPayment = d3.select("#capAtPercentPayment").classed("on")
	inputs.percentLoan = parseFloat($("#percentLoan").val())

	return inputs;
}


function getStandardRepayment(opts){
	var loanAmount = opts.loanAmount;
	var loan = loan + opts.standardFee;
	var adjEquivInterest = Math.pow( (1+(opts.interestRate/365.0)) , (365.0/12.0) ) - 1

	var annualPayment = (loanAmount*adjEquivInterest*(Math.pow((1+adjEquivInterest),120)))/((Math.pow((1+adjEquivInterest),120))-1)*12

	return annualPayment
}


function getNPV(agi, year, opts){
	// if(year === 0 && agi == 5000){
	// 	console.log(opts)
	// }
	var loanAmount = opts.loanAmount;
	var income = agi;
	for(var y = 0; y < year; y++){
		income = income * (1 + opts.incomeIncrease)
	}

	var adjustedPercentFPL;
	// if(opts.excludeIncome){	console.log(opts.excludeIncome, income, fplIncome)}
	if(opts.excludeIncome && income > opts.fplIncome){
		// console.log(opts.fplIncome, opts.fplReduction, income)
		var incomeFloor = (Math.floor(income/1000)) * 1000
		var diff = (incomeFloor - opts.fplIncome) / 1000
		adjustedPercentFPL = Math.max(0,opts.percentFPL - opts.fplReduction*diff)
		// console.log(adjustedPercentFPL)
	}else{
		adjustedPercentFPL = opts.percentFPL
	}

	var incPay;
	var inc = opts.percentDiscretionaryAGI*(income-adjustedPercentFPL*opts.povertyLevel*Math.pow((1+opts.inflation),year))
	var minAnnualPayment = opts.minPayment*12;
	if(minAnnualPayment > inc){
		incPay = minAnnualPayment;
	}else{
			incPay = inc;
	}
	var prevBalance = (year == 0) ? loanAmount : PREV_DATA[agi]["balance"][year - 1];
	var balance = prevBalance * (1+(opts.interestRate)) - incPay


	var yearlyPayment, yearlyUnbounded;
	if((opts.capAtStandardRepayment && year != 0) || (opts.capAtPercentPayment && year != 0)){
	// if(false){
		var sumInc = incPay;
		for(var i = 0; i < year; i++){
			sumInc += PREV_DATA[agi]["incPay"][i]
		}
		var sumPay = 0;
		for(var i = 0; i < year; i++){
		// 	console.log(i, year)
			sumPay += PREV_DATA[agi]["yearlyPayment"][i]
		}

		var totalRepayment = opts.standardRepayment*opts.standardYears
		var percentLoanCap = loanAmount*(1+opts.percentLoan)

		// console.log(totalRepayment, percentLoanCap)

		var cap = (opts.capAtStandardRepayment) ? totalRepayment : percentLoanCap

		if(opts.capAtPercentPayment){
			yearlyUnbounded = (balance > 0) ? incPay : incPay + balance;
			if(sumPay >= cap){
				yearlyPayment = 0
			}
			else{
				if(sumPay + inc >cap && prevBalance > 0){
					yearlyPayment = Math.min(cap - sumPay, prevBalance)
				}else{
					var temp = (balance > 0) ? incPay : incPay + balance
					yearlyPayment = Math.max(temp, 0)
				}
			}
			
		}else{


			if(sumInc >= cap && sumPay < cap){
				yearlyPayment = cap - sumPay
			}else{
				if(sumInc >= cap && sumPay >= cap){
					yearlyPayment = 0
				}else{
					yearlyPayment = incPay
				}
			}
		}
		// console.log(yearlyPayment, agi)

		// console.log(sumInc)
	}else{
		yearlyUnbounded = (balance > 0) ? incPay : incPay + balance;
		yearlyPayment = (yearlyUnbounded < 0) ? 0 : yearlyUnbounded;
	}

	var NPV = yearlyPayment / Math.pow(1+opts.discountRate, year+1)

	if(PREV_DATA.hasOwnProperty(agi)){
		var el = PREV_DATA[agi]
		el.NPV.push(NPV)
		el.balance.push(balance)
		el.incPay.push(incPay)
		el.yearlyPayment.push(yearlyPayment)
	}else{
		PREV_DATA[agi] = {}
		var el = PREV_DATA[agi]
		el.NPV = [NPV]
		el.balance = [balance]
		el.incPay = [incPay]
		el.yearlyPayment = [yearlyPayment]
	}
	// console.log(PREV_DATA)
	return [NPV, balance, incPay, yearlyPayment];

}

function PV(discountRate, years, standardRepayment){
	//Excel PV function found here https://support.office.com/en-us/article/PV-function-23879d31-0e02-4321-be01-da16e8168cbd
	//pv * (1+rate)^nper + pmt(1 + rate*type)* ( (1+rate)^nper -1  )/rate +fv = 0
	//fv = 0, type = 0 (payments due at end of period)
	var n = Math.pow(1 + discountRate, years)
	return (-1*standardRepayment* ((n - 1)/discountRate))/n

}

function buildOpts(){
	var globals = getGlobals();
	var inputs = getInputs();

	var opts = $.extend(globals, inputs);
	var standardRepayment = getStandardRepayment(opts)

	opts["standardRepayment"] = standardRepayment
	opts["totalStandardRepayment"] = -PV(opts.discountRate, opts.standardYears, standardRepayment);

	return opts
}
function getYearsToRepay(agi){

	var opts = buildOpts()

	var yearMax = (opts.capAtStandardRepayment) ? MAX_YEARS : opts.forgivenessPeriod;
	

	for(var i = 0; i < yearMax; i++){

		var npv = getNPV(agi, i, opts)[0]
		var balance = getNPV(agi, i, opts)[1]


		if(npv <= .1 && balance <= .1){
			return i;
		}
	}
	return yearMax	
}

function getTotalRepayment(agi){
	var opts = buildOpts();
	
	var totalNPV = 0;
	var yearMax = (opts.capAtStandardRepayment) ? MAX_YEARS : opts.forgivenessPeriod;


	for(var i = 0; i < yearMax; i++){
		totalNPV += getNPV(agi, i, opts)[0]
	}
	return totalNPV
	
}


function buildAllData(){
	buildRepaymentData(function(dollarData){
		buildYearsData(function(yearData){
			var opts = buildOpts();

		    var s = "adjusted_gross_income,total_repaid,years_to_repay,loan_amount,percent_discretionary_agi,minimum_payment,discretionary_cutoff,reduce_cutoff_based_on_income,income_cutoff,reduction_amount,forgiveness_at_match_standard,forgiveness_period,forgiveness_at_percent_initial_loan,percent_initial_loan,annual_income_increase,poverty_level,discount_rate,inflation_rate,interest_rate,standard_repayment_fee,standard_number_of_years,standard_annual_payment,standard_total_payment_present_value"
		    s += "\r\n"

		    for(var i = 0; i < dollarData.length; i++){
		    	var agi = dollarData[i]["agi"];
		    	var npv = dollarData[i]["npv"];
		    	var yearDatum = yearData.filter(function(d){ return d["agi"] == agi });
		    	var years = yearDatum[0]["years"];

		    	var yearMax = (opts.capAtStandardRepayment) ? MAX_YEARS : opts.forgivenessPeriod;
		    	var match = (opts.capAtStandardRepayment) ? "YES" : "NO";
		    	var exclude = (opts.excludeIncome) ? "YES" : "NO"
		    	var percentPayment = (opts.capAtPercentPayment) ? "YES" : "NO"
		    	s += agi + "," + npv + "," + years + "," + opts.loanAmount + "," + opts.percentDiscretionaryAGI + "," + opts.minPayment + "," + opts.percentFPL + "," + exclude + "," + opts.fplIncome + "," + opts.fplReduction + "," + match + ","  + yearMax + "," + percentPayment + "," + opts.percentLoan + "," + opts.incomeIncrease + "," + opts.povertyLevel + "," + opts.discountRate + "," + opts.inflation + "," + opts.interestRate + "," + opts.standardFee + "," + opts.standardYears + "," + opts.standardRepayment + "," + opts.totalStandardRepayment;
		    	s += "\r\n"
		    }



		    var csvData = encodeURIComponent(s)
		    var encodedUri = 'data:Application/octet-stream,' + csvData;
		    d3.select('#downloadData a')
		        .attr('href', encodedUri)
		        .attr('download', 'idr-data.csv');

		})
	})
}
function buildRepaymentData(callback){
	var data = []
	var opts = buildOpts();

	if(!opts.excludeIncome){ disableFpl() }
	else{ enableFpl() }

	if(opts.forgivenessPeriod == MAX_YEARS){ disableForgiveness(true) }
	else{ enableForgiveness(opts.forgivenessPeriod) }

	if(opts.capAtStandardRepayment){
		
		disableForgiveness(false)
	}
	else{ enableForgiveness(opts.forgivenessPeriod) }

	if(!opts.capAtPercentPayment){disablePercentPayment() }
	else{
		enablePercentPayment()
	}

	for(var agi = 5000; agi <= 140000; agi += 500){
		datum = {"agi": agi, "totalStandardRepayment": opts.totalStandardRepayment, "npv": getTotalRepayment(agi)}
		data.push(datum)
	}
	callback(data)

}
function buildRepaymentChart(){
	var w, h;
	if (IS_MOBILE()){ w = 700}
	else if(IS_PHONE()){ w = 300}
	else{ w = 500 }
	h = 500

	var formatter = (IS_PHONE()) ? SHORT_DOLLARS : DOLLARS;
	var marginLeft = (IS_PHONE()) ? 40 : 60;
	var marginRight = (IS_PHONE()) ? 20 : 80;

	var svg = d3.select("#repaymentChart").append("svg").attr("width", w).attr("height",h),
	    margin = {top: 30, right: marginRight, bottom: 60, left: marginLeft},
	    width = w - margin.left - margin.right,
	    // width = w - margin.right,
	    height = h - margin.top - margin.bottom,
	    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");


	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.npv); });

	buildRepaymentData(function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			50000
		]);


		var xAx = g.append("g")
		  .attr("class", "axis axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x).tickFormat(formatter).tickValues([0,20000,40000,60000,80000,100000,120000,140000]));
		xAx.selectAll(".tick text").attr("x", function(d){ return (d == 0) ? 15 : 0})
		xAx.selectAll(".tick line").attr("opacity", function(d){ return (d == 0) ? 0 : 1})

		var axis = g.append("g")
		  .attr("class", "axis axis--y")
		  .call(d3.axisLeft(y).tickSize(-width).tickFormat(formatter))

		g.append("text")
			.attr("class", "axisLabel")
			.attr("x",-60)
			.attr("y", -17)
			.attr("text-anchor","start")
			.text("Net present dollars")

		g.append("text")
			.attr("class", "axisLabel xLabel")
			.attr("x",width/2)
			.attr("y", height + 40)
			.attr("text-anchor","middle")
			.text("Starting income")


		axis.selectAll(".tick text").attr("x", -6)
		axis.selectAll(".tick line").style("opacity", function(d){ return (d==0) ? 0 : 1})


		g.append("path")
		  .datum(data)
		  .attr("class", "repaymentLine input")
		  .attr("d", line);

		g.append("line")
		  .datum(data)
  		  .attr("class", "repaymentLine fixed")
		  .attr("x1", x(5000))
		  .attr("x2", width)
		  .attr("y1", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		  .attr("y2", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		g.append("text")
			.datum(data)
			.attr("id", "tenYearLabel")
			.attr("y", function(d){
		  		return y(d[0]["totalStandardRepayment"]) - 6
		  	})
		  	.attr("x", (width - 136)*.5)
		  	.text("Standard 10-year plan")
	})

}

function updateRepaymentChart(){
	var svg = d3.select("#repaymentChart").select("svg")

	var formatter = (IS_PHONE()) ? SHORT_DOLLARS : DOLLARS;

	var marginLeft = (IS_PHONE()) ? 40 : 60;
	var marginRight = (IS_PHONE()) ? 20 : 80;

	var w, h;
	if (IS_MOBILE()){ w = 700}
	else if(IS_PHONE()){ w = 300}
	else{ w = 500 }
	h = 500

	var	margin = {top: 30, right: marginRight, bottom: 60, left: marginLeft},
	    width = w - margin.left - margin.right,
	    // width = w - margin.right,
	    height = h - margin.top - margin.bottom;

	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.npv); });

	buildRepaymentData(function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));
		var yMax;
		if(d3.max(data, function(d){ return d.npv}) >= 150000){
			yMax = 230000;
		}
		else if (d3.max(data, function(d){ return d.npv}) <= 50000){
			yMax = 50000;
		}else{
			yMax = 160000;
		}
		y.domain([
			0,
			yMax
		]);

		var xAx = svg.selectAll(".axis.axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x).tickFormat(formatter).tickValues([0,20000,40000,60000,80000,100000,120000,140000]));
		xAx.selectAll(".tick text").attr("x", function(d){ return (d == 0) ? 15 : 0})
		xAx.selectAll(".tick line").attr("opacity", function(d){ return (d == 0) ? 0 : 1})


		svg.selectAll(".axisLabel.xLabel")
			.attr("x",width/2)
			.attr("y", height + 40)


		var axis = svg.selectAll(".axis.axis--y")
			.transition()
			.call(d3.axisLeft(y).tickSize(-width).tickFormat(formatter))

		axis.selectAll(".tick text").attr("x", -6)
		axis.selectAll(".tick line").style("opacity", function(d){ return (d==0) ? 0 : 1})


		svg.selectAll(".repaymentLine.input")
		  .datum(data)
		  .transition()
		  .attr("d", line);

		svg.selectAll(".repaymentLine.fixed")
		  .datum(data)
		  .transition()
		  .attr("x1", x(5000))
		  .attr("x2", width)
		  .attr("y1", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		  .attr("y2", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		svg.selectAll("#tenYearLabel")
			.datum(data)
			.transition()
		  	.attr("x", (width - 136)*.5)
			.attr("y", function(d){
		  		return y(d[0]["totalStandardRepayment"]) - 6
		  	})
	})

}




function buildYearsData(callback){
	var data = []
	var globals = getGlobals();
	var inputs = getInputs();

	var opts = $.extend(globals, inputs);

	for(var agi = 5000; agi <= 140000; agi += 500){
		datum = {"agi": agi, "years": getYearsToRepay(agi)}
		data.push(datum)
	}
	callback(data)

}
function buildYearsChart(){
	var formatter = (IS_PHONE()) ? SHORT_DOLLARS : DOLLARS;
	var marginRight = (IS_PHONE()) ? 20 : 80;

	var w, h;
	if (IS_MOBILE()){ w = 700}
	else if(IS_PHONE()){ w = 300}
	else{ w = 500 }
	h = 500

	var svg = d3.select("#yearsChart").append("svg").attr("width", w).attr("height",h),
	    margin = {top: 30, right: marginRight, bottom: 60, left: 20},
	    width = w - margin.left - margin.right,
	    // width = w - margin.right,
	    height = h - margin.top - margin.bottom,
	    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");


	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.years); });

	buildYearsData(function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			50
		]);


		var xAx = g.append("g")
		  .attr("class", "axis axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x).tickFormat(formatter).tickValues([0,20000,40000,60000,80000,100000,120000,140000]));
		xAx.selectAll(".tick text").attr("x", function(d){ return (d == 0) ? 15 : 0})
		xAx.selectAll(".tick line").attr("opacity", function(d){ return (d == 0) ? 0 : 1})

		var axis = g.append("g")
		  .attr("class", "axis axis--y")
		  .call(d3.axisLeft(y).tickSize(-width))

		g.append("text")
			.attr("class", "axisLabel")
			.attr("x",-20)
			.attr("y", -15)
			.attr("text-anchor","start")
			.text("Years")

		g.append("text")
			.attr("class", "axisLabel xLabel")
			.attr("x",width/2)
			.attr("y", height + 40)
			.attr("text-anchor","middle")
			.text("Starting income")

		axis.append("text")
		  .attr("transform", "rotate(-90)")
		  .attr("y", 6)
		  .attr("dy", "0.71em")
		  .attr("fill", "#000")

		axis.selectAll(".tick text").attr("x", -6)
		axis.selectAll(".tick line").style("opacity", function(d){ return (d==0) ? 0 : 1})


		g.append("path")
		  .datum(data)
		  .attr("class", "yearsLine")
		  .attr("d", line);

	})

}
function updateYearsChart(){
	var svg = d3.select("#yearsChart").select("svg")
	var formatter = (IS_PHONE()) ? SHORT_DOLLARS : DOLLARS;

	var marginRight = (IS_PHONE()) ? 20 : 80;
	var w, h;
	if (IS_MOBILE()){ w = 700}
	else if(IS_PHONE()){ w = 300}
	else{ w = 500 }
	h = 500

	var	margin = {top: 30, right: marginRight, bottom: 60, left: 20},
	    width = w - margin.left - margin.right,
	    // width = w - margin.right,
	    height = h - margin.top - margin.bottom;

	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.years); });

	buildYearsData(function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			50
		]);

		var axis = svg.selectAll(".axis.axis--y")
			.transition()
			.call(d3.axisLeft(y).tickSize(-width))
		axis.selectAll(".tick text").attr("x", -6)
		axis.selectAll(".tick line").style("opacity", function(d){ return (d==0) ? 0 : 1})

		var xAx = svg.selectAll(".axis.axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x).tickFormat(formatter).tickValues([0,20000,40000,60000,80000,100000,120000,140000]));
		xAx.selectAll(".tick text").attr("x", function(d){ return (d == 0) ? 15 : 0})
		xAx.selectAll(".tick line").attr("opacity", function(d){ return (d == 0) ? 0 : 1})

		svg.selectAll(".axisLabel.xLabel")
			.attr("x",width/2)
			.attr("y", height + 40)



		svg.selectAll(".yearsLine")
		  .datum(data)
		  .transition()
		  .attr("d", line);

	})

}

function buildGradient(){
  var svg = d3.select("#gradientHolder")
      .attr("width", 1200)
      .attr("height", 180)
  var gradient = svg.append("svg:defs")
    .append("svg:linearGradient")
      .attr("id", "gradient")
      .attr("x1", "0%")
      .attr("y2", "0%")
      .attr("x2", "0%")
      .attr("y1", "100%")
      .attr("spreadMethod", "pad");

  gradient.append("svg:stop")
      .attr("offset", "0%")
      .attr("stop-color", "#fff")
      .attr("stop-opacity", 1);

  gradient.append("svg:stop")
      .attr("offset", "100%")
      .attr("stop-color", "#fff")
      .attr("stop-opacity", .3);

  svg.append("rect")
      .attr("class", "scrollFade gradient")
      .attr("x",0)
      .attr("y",0)
      .attr("width", 1200)
      .attr("height", 200)
      .attr("fill", "url(#gradient)")
}

function disableForgiveness(maxYear){
	d3.select("#forgivenessPeriod").classed("disabled", !maxYear)
	d3.select(".controlContainer.forgivenessPeriod .valLabel").classed("disabled", !maxYear)
	d3.select(".controlContainer.forgivenessPeriod .suffix").classed("disabled", !maxYear)
	d3.select("#noForgiveness").classed("disabled", true)
	$("#forgivenessPeriod").val(50)
	$("#forgivenessPeriodLabel").val(50)
}
function enableForgiveness(years){

	var fp = (typeof(d3.select("#forgivenessPeriod").datum()) == "undefined") ? years : d3.select("#forgivenessPeriod").datum()
	
	$("#forgivenessPeriod").val(fp)
	$("#forgivenessPeriodLabel").val(fp)

	if(years == MAX_YEARS){ return false}
	d3.select("#forgivenessPeriod").classed("disabled", false)
	d3.select(".controlContainer.forgivenessPeriod .valLabel").classed("disabled", false)
	d3.select(".controlContainer.forgivenessPeriod .suffix").classed("disabled", false)
	d3.select("#noForgiveness").classed("disabled", false)
	

	
}

function disableFpl(){
	d3.select("#fplIncome").classed("disabled", true)
	d3.select(".controlContainer.fplIncome .valLabel").classed("disabled", true)
	d3.select(".controlContainer.fplIncome .prefix").classed("disabled", true)
	d3.select(".controlContainer.fplIncome .suffix").classed("disabled", true)

	d3.select("#fplReduction").classed("disabled", true)
	d3.select(".controlContainer.fplReduction .valLabel").classed("disabled", true)
	d3.select(".controlContainer.fplReduction .suffix").classed("disabled", true)


	var fi = (typeof(d3.select("#fplIncome").datum()) == "undefined") ? 120000 : d3.select("#fplIncome").datum()
	$("#fplIncome").val(fi)
	$(".valLabel.fplIncome").val(fi/1000)

	var fr = (typeof(d3.select("#fplReduction").datum()) == "undefined") ? .05 : d3.select("#fplReduction").datum()
	$("#fplReduction").val(fr)
	$(".valLabel.fplReduction").val(fr*100)
}
function enableFpl(years){
	d3.select("#fplIncome").classed("disabled", false)
	d3.select(".controlContainer.fplIncome .valLabel").classed("disabled", false)
	d3.select(".controlContainer.fplIncome .prefix").classed("disabled", false)
	d3.select(".controlContainer.fplIncome .suffix").classed("disabled", false)

	d3.select("#fplReduction").classed("disabled", false)
	d3.select(".controlContainer.fplReduction .valLabel").classed("disabled", false)
	d3.select(".controlContainer.fplReduction .suffix").classed("disabled", false)

}

function disablePercentPayment(){
	d3.select("#percentLoan").classed("disabled", true)
	d3.select(".controlContainer.percentLoan .valLabel").classed("disabled", true)
	d3.select(".controlContainer.percentLoan .suffix").classed("disabled", true)

	var pl = (typeof(d3.select("#percentLoan").datum()) == "undefined") ? .5 : d3.select("#percentLoan").datum()
	$("#percentLoan").val(pl)
	$(".valLabel.percentLoan").val(pl *100)

}
function enablePercentPayment(years){
	d3.select("#percentLoan").classed("disabled", false)
	d3.select(".controlContainer.percentLoan .valLabel").classed("disabled", false)
	d3.select(".controlContainer.percentLoan .suffix").classed("disabled", false)
}

function setPlan(o, id){
	var elems = ["percentDiscretionaryAGI", "forgivenessPeriod", "minPayment","percentFPL","fplReduction","fplIncome","percentLoan"]
	for(var i =0; i < elems.length; i++){
		var el = elems[i]
		var mult = (el == "percentDiscretionaryAGI" || el == "percentFPL" || el == "fplReduction" || el == "percentLoan") ? 100 : 1;
		if(el == "fplIncome"){ mult = 1/1000}
		if(el == "fplReduction" || el == "fplIncome" || el == "percentLoan"){
			d3.select("#" + el).datum(o[el])
		}
		if(o[el] != null){
			var val = o[el]
			if(el == "percentDiscretionaryAGI"){
				if (val >= 1) { $(".controlContainer." + el).find(".valLabel").css("width","43px") }
				else if(val >= .1){ $(".controlContainer." + el).find(".valLabel").css("width","36px") }
				else{ $(".controlContainer." + el).find(".valLabel").css("width","26px") }
			}
			else if(el == "forgivenessPeriod"){
				d3.select("#forgivenessPeriod").datum(o[el])
				if (val < 10) { $(".controlContainer." + el).find(".valLabel").css("width","53px") }
				else{ $(".controlContainer." + el).find(".valLabel").css("width","61px") }			
			}
			else if(el == "minPayment"){
				if (val >= 100) { $(".controlContainer." + el).find(".valLabel").css("width","41px") }
				else if(val >= 10){ $(".controlContainer." + el).find(".valLabel").css("width","34px") }
				else{ $(".controlContainer." + el).find(".valLabel").css("width","24px") }	
			}
			else if(el == "fplIncome"){
				if (val >= 100000) { $(".controlContainer." + el).find(".valLabel").css("width","53px") }
				else if(val >= 10000){ $(".controlContainer." + el).find(".valLabel").css("width","46px") }
				else{ $(".controlContainer." + el).find(".valLabel").css("width","36px") }	

			}
			$(".controlContainer." + el).find(".valLabel").val(parseInt(val*mult))
			$(".controlContainer." + el).find(".controlSlider").val(val)
		}
		if(o["capAtStandardRepayment"] != null){
			var val = o["capAtStandardRepayment"]
			d3.select("#capAtStandardRepayment").classed("on", val)
			d3.select("#capAtStandardRepayment").classed("off", !val)
		}
		if(o["capAtPercentPayment"] != null){
			var val = o["capAtPercentPayment"]
			d3.select("#capAtPercentPayment").classed("on", val)
			d3.select("#capAtPercentPayment").classed("off", !val)
		}
		if(o["excludeIncome"] != null){
			var val = o["excludeIncome"]
			d3.select("#excludeIncome").classed("on", val)
			d3.select("#excludeIncome").classed("off", !val)
		}

	}
	updateCharts();	
	d3.select(".button." + id).classed("clicked", true)
	
}


function buildCharts(){
	buildRepaymentChart();
	buildYearsChart();
	buildAllData();
	buildGradient();
}
function updateCharts(){
	
	d3.selectAll(".button.clicked").classed("clicked", false)
	
	updateRepaymentChart();
	updateYearsChart();
	buildAllData();
}
function scrollDown(){
	$("html, body").animate({ scrollTop: $('#controls').offset().top - 80 }, 1000);
}


var isIE = function() {
var userAgent = navigator.userAgent;
return userAgent.indexOf('MSIE') !== -1 ||  
  userAgent.indexOf('Trident') !== -1;
};


var sliderEvent = isIE() ? "change" : "input"




d3.selectAll("#percentFPL").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()
	if (val >= 1) { $(this.parentNode).find(".valLabel").css("width","45px") }
	else if(val >= .1){ $(this.parentNode).find(".valLabel").css("width","36px") }
	else{ $(this.parentNode).find(".valLabel").css("width","26px") }
	$(this.parentNode).find(".valLabel").val(parseInt(val*100))
	updateCharts()
})
d3.selectAll(".controlContainer.percentFPL .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))
	if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","45px") }
	else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","36px") }
	else{ $(this.parentNode).find(".valLabel").css("width","26px") }

	if(val > max){ val = max }
	if(val < min){ val = min }
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val/100.0))
	updateCharts()
})

d3.selectAll("#fplIncome").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()
	if( ! d3.select("#fplIncome").classed("disabled") ){
		d3.select("#fplIncome").datum(val)
		if (val >= 100000) { $(this.parentNode).find(".valLabel").css("width","53px") }
		else if(val >= 10000){ $(this.parentNode).find(".valLabel").css("width","46px") }
		else{ $(this.parentNode).find(".valLabel").css("width","36px") }
	}

	$(this.parentNode).find(".valLabel").val(parseInt(val/1000))
	updateCharts()
})
d3.selectAll(".controlContainer.fplIncome .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))
	if( ! d3.select("#fplIncome").classed("disabled") ){
		d3.select("#fplIncome").datum(val)
		if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","53px") }
		else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","46px") }
		else{ $(this.parentNode).find(".valLabel").css("width","36px") }

		if(val > max){ val = max }
		if(val < min){ val = min }
	}
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val*1000))
	updateCharts()
})

d3.selectAll("#fplReduction").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()
	if( ! d3.select("#fplReduction").classed("disabled") ){
		d3.select(this).datum(val)

		if (val >= 1) { $(this.parentNode).find(".valLabel").css("width","43px") }
		else if(val >= .1){ $(this.parentNode).find(".valLabel").css("width","36px") }
		else{ $(this.parentNode).find(".valLabel").css("width","26px") }
	}
	$(this.parentNode).find(".valLabel").val(parseInt(val*100))
	updateCharts()
})
d3.selectAll(".controlContainer.fplReduction .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))
	if( ! d3.select("#fplReduction").classed("disabled") ){
		d3.select("#fplReduction").datum(val)
		if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","43px") }
		else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","36px") }
		else{ $(this.parentNode).find(".valLabel").css("width","26px") }

		if(val > max){ val = max }
		if(val < min){ val = min }
	}
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val/100.0))
	updateCharts()
})

d3.selectAll("#percentLoan").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()
	if( ! d3.select("#percentLoan").classed("disabled") ){
		d3.select("#percentLoan").datum(val)
		if (val >= 1) { $(this.parentNode).find(".valLabel").css("width","43px") }
		else if(val >= .1){ $(this.parentNode).find(".valLabel").css("width","36px") }
		else{ $(this.parentNode).find(".valLabel").css("width","26px") }
	}

	$(this.parentNode).find(".valLabel").val(parseInt(val*100))
	updateCharts()
})
d3.selectAll(".controlContainer.percentLoan .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))
	if( ! d3.select("#percentLoan").classed("disabled") ){
		d3.select("#percentLoan").datum(val)
		if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","43px") }
		else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","36px") }
		else{ $(this.parentNode).find(".valLabel").css("width","26px") }

		if(val > max){ val = max }
		if(val < min){ val = min }
	}
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val/100.0))
	updateCharts()
})

d3.selectAll("#percentDiscretionaryAGI").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()
	if (val >= 1) { $(this.parentNode).find(".valLabel").css("width","43px") }
	else if(val >= .1){ $(this.parentNode).find(".valLabel").css("width","36px") }
	else{ $(this.parentNode).find(".valLabel").css("width","26px") }
	$(this.parentNode).find(".valLabel").val(parseInt(val*100))
	updateCharts()
})
d3.selectAll(".controlContainer.percentDiscretionaryAGI .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))
	if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","43px") }
	else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","36px") }
	else{ $(this.parentNode).find(".valLabel").css("width","26px") }

	if(val > max){ val = max }
	if(val < min){ val = min }
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val/100.0))
	updateCharts()
})

d3.selectAll("#forgivenessPeriod").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()
	if( ! d3.select("#forgivenessPeriod").classed("disabled") ){
		d3.select("#forgivenessPeriod").datum(val)
		if (val < 10) { $(this.parentNode).find(".valLabel").css("width","53px") }
		else{ $(this.parentNode).find(".valLabel").css("width","61px") }

		if(val == 1){ d3.select(".suffix.years").text("year")}
		else{ d3.select(".suffix.years").text("years")}
	}

	$(this.parentNode).find(".valLabel").val(parseInt(val))
	updateCharts()
})
d3.selectAll(".controlContainer.forgivenessPeriod .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))
	if( ! d3.select("#forgivenessPeriod").classed("disabled") ){
		if (val < 10) { $(this.parentNode).find(".valLabel").css("width","53px") }
		else{ $(this.parentNode).find(".valLabel").css("width","61px") }

		if(val == 1){ d3.select(".suffix.years").text("year")}
		else{ d3.select(".suffix.years").text("years")}
	}

	if(val > max){ val = max }
	if(val < min){ val = min }
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val))
	updateCharts()
})

d3.selectAll("#minPayment").on(sliderEvent, function(){
	PREV_DATA = {}
	var val = $(this).val()

	if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","41px") }
	else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","34px") }
	else{ $(this.parentNode).find(".valLabel").css("width","24px") }

	$(this.parentNode).find(".valLabel").val(parseInt(val))
	updateCharts()
})
d3.selectAll(".controlContainer.minPayment .valLabel").on("input", function(){
	PREV_DATA = {}
	var val = parseInt($(this).val()),
		max = parseInt($(this).attr("max")),
		min = parseInt($(this).attr("min"))

	if (val >= 100) { $(this.parentNode).find(".valLabel").css("width","41px") }
	else if(val >= 10){ $(this.parentNode).find(".valLabel").css("width","34px") }
	else{ $(this.parentNode).find(".valLabel").css("width","24px") }

	if(val > max){ val = max }
	if(val < min){ val = min }
	$(this).val(val)
	$(this.parentNode).find(".controlSlider").val(parseFloat(val))
	updateCharts()
})


d3.selectAll("#loanAmount").on(sliderEvent, function(){
	PREV_DATA = {}
	var formatter = d3.format("$,.0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))

	$("#yearsTitle").find(".valLabel").text(formatter(val))
	$("#loanAmount2").val(val)
	updateCharts()
})
d3.selectAll("#loanAmount2").on(sliderEvent, function(){
	PREV_DATA = {}
	var formatter = d3.format("$,.0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))

	$("#repaymentTitle").find(".valLabel").text(formatter(val))
	$("#loanAmount").val(val)
	updateCharts()
})
// d3.selectAll("#capAtStandardRepayment").on("change", function(){
// 	PREV_DATA = {}
// 	updateCharts()	
// })



d3.selectAll(".switch")
.on("click", function(){
	PREV_DATA = {}
	if(d3.select(this).classed("on")){
	d3.select(this).classed("on", false)
	d3.select(this).classed("off", true)
	}else{
	d3.select(this).classed("on", true)
	d3.select(this).classed("off", false)
	}
	if(this.id == "capAtStandardRepayment"){
		d3.select("#capAtPercentPayment").classed("on", false).classed("off", true)
	}
	if(this.id == "capAtPercentPayment"){
		d3.select("#capAtStandardRepayment").classed("on", false).classed("off", true)
	}

	updateCharts();
})


d3.selectAll(".repayeUndergrad").on("click", function(){
	PREV_DATA = {}
	if(d3.select(this).classed("buttonLink")){ scrollDown()}
	var o = {"percentFPL":1.5, "percentDiscretionaryAGI":.1, "minPayment":0, "forgivenessPeriod":20,"capAtStandardRepayment":false, "loanAmount": null, "excludeIncome":false, "fplIncome": null, "fplReduction": null, "capAtPercentPayment": false}
	setPlan(o, "repayeUndergrad")
})
d3.selectAll(".repayeGrad").on("click", function(){
	PREV_DATA = {}
	if(d3.select(this).classed("buttonLink")){ scrollDown()}
	var o = {"percentFPL":1.5, "percentDiscretionaryAGI":.1, "minPayment":0, "forgivenessPeriod":25,"capAtStandardRepayment":false, "loanAmount": null, "excludeIncome":false, "fplIncome": null, "fplReduction": null, "capAtPercentPayment": false}
	setPlan(o, "repayeGrad")
})
d3.selectAll(".repayePSLF").on("click", function(){
	PREV_DATA = {}
	if(d3.select(this).classed("buttonLink")){ scrollDown()}
	var o = {"percentFPL":1.5, "percentDiscretionaryAGI":.1, "minPayment":0, "forgivenessPeriod":10,"capAtStandardRepayment":false, "loanAmount": null, "excludeIncome":false, "fplIncome": null, "fplReduction": null, "capAtPercentPayment": false}
	setPlan(o, "repayePSLF")
})
d3.selectAll(".prosper").on("click", function(){
	PREV_DATA = {}
	if(d3.select(this).classed("buttonLink")){ scrollDown()}
	var o = {"percentFPL":1.5, "percentDiscretionaryAGI":.15, "minPayment":25, "forgivenessPeriod":50,"capAtStandardRepayment":true, "loanAmount": null, "excludeIncome":false, "fplIncome": null, "fplReduction": null, "capAtPercentPayment": false}
	setPlan(o, "prosper")
})
d3.selectAll(".aimHigher").on("click", function(){
	PREV_DATA = {}
	if(d3.select(this).classed("buttonLink")){ scrollDown()}
	var o = {"percentFPL":2.5, "percentDiscretionaryAGI":.1, "minPayment":0, "forgivenessPeriod":20,"capAtStandardRepayment":false, "loanAmount": null, "excludeIncome":true, "fplIncome": 120000, "fplReduction": .05, "capAtPercentPayment": true, "percentLoan": .5}
	setPlan(o, "aimHigher")
})






d3.select("#clickToExpand").on("click", function(){
	var full_height = $("#topText")[0].scrollHeight
	if(d3.select(this).classed("closed")){
		d3.select(this).classed("closed", false)
			.text("Click to hide")
		d3.select("#topText")
			.transition()
			.style("height", full_height + "px")
		d3.select("#gradientHolder")
			.transition()
			.style("opacity",0)
	}else{
		d3.select(this).classed("closed", true)
			.text("Click to read more")
		d3.select("#topText")
			.transition()
			.style("height", "400px")
		d3.select("#gradientHolder")
			.transition()
			.style("opacity",1)

	}
})


$( window ).resize(function() {
	d3.select("#topText")
		.style("height", "0px")
	var full_height = $("#topText")[0].scrollHeight

	if(! d3.select("#clickToExpand").classed("closed")){
		d3.select("#topText")
			.style("height", full_height + "px")
	}else{
		d3.select("#topText")
			.style("height", "400px")		
	}

	PREV_DATA = {}
	updateCharts();
});
buildCharts()