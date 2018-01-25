		<div id = "buttons">
			<div class = "button" id = "repayeUndergrad">REPAYE undergraduate</div>
			<div class = "button" id = "repayeGrad">REPAYE graduate</div>
			<div class = "button" id = "repayePSLF">REPAYE with PSLF</div>
			<div class = "button" id = "prosper">HEA PROSPER plan</div>
		</div>


var PREV_BALANCE;
var PREV_DATA = {}
var DOLLARS = d3.format("$,.0f")
var MAX_YEARS = 50;

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

function getInputs(o){
	var inputs = {}

	if(o.percentDiscretionaryAGI != null){
		inputs.percentDiscretionaryAGI = o.percentDiscretionaryAGI
	}else{
		inputs.percentDiscretionaryAGI = parseFloat($("#percentDiscretionaryAGI").val())
	}

	if(o.forgivenessPeriod != null){
		inputs.forgivenessPeriod = o.forgivenessPeriod
	}else{
		inputs.forgivenessPeriod = parseFloat($("#forgivenessPeriod").val())
	}

	if(o.loanAmount != null){
		inputs.loanAmount = o.loanAmount
	}else{
		inputs.loanAmount = parseFloat($("#loanAmount").val())
	}

	if(o.capAtStandardRepayment != null){
		inputs.capAtStandardRepayment = o.capAtStandardRepayment
	}else{
		inputs.capAtStandardRepayment = document.getElementById("capAtStandardRepayment").checked
	}

	if(o.minPayment != null){
		inputs.minPayment = o.minPayment
	}else{
		inputs.minPayment = parseFloat($("#minPayment").val())
	}
	return inputs;
}


function getStandardRepayment(opts){
	var loanAmount = opts.loanAmount;
	var loan = loan + opts.standardFee;
	var adjEquivInterest = Math.pow( (1+(opts.interestRate/365.0)) , (365.0/12.0) ) - 1

	var annualPayment = (loanAmount*adjEquivInterest*(Math.pow((1+adjEquivInterest),120)))/((Math.pow((1+adjEquivInterest),120))-1)*12

	return annualPayment
}


function getNPV(o, agi, year){
	var opts = buildOpts(o)

	// console.dir(opts)

	var loanAmount = opts.loanAmount;
	var income = agi;
	for(var y = 0; y < year; y++){
		income = income * (1 + opts.incomeIncrease)
	}

	var incPay;
	var inc = opts.percentDiscretionaryAGI*(income-1.5*opts.povertyLevel*Math.pow((1+opts.inflation),year))
	var minAnnualPayment = opts.minPayment*12;
	if(minAnnualPayment > inc){
		incPay = minAnnualPayment;
	}else{
		if(opts.standardRepayment < inc){
			incPay = opts.standardRepayment
		}else{
			incPay = inc;
		}
	}
	var prevBalance = (year == 0) ? loanAmount : PREV_DATA[agi]["balance"][year - 1];
	var balance = prevBalance * (1+(opts.interestRate)) - incPay


	var yearlyPayment, yearlyUnbounded;
	if(opts.capAtStandardRepayment == true && year != 0){
	// if(false){
		var sumInc = incPay;
		for(var i = 0; i < year; i++){
			sumInc += PREV_DATA[agi]["incPay"][i]
		}
		var sumPay = 0;
		for(var i = 0; i < year; i++){
			sumPay += PREV_DATA[agi]["yearlyPayment"][i]
		}

		var totalRepayment = opts.standardRepayment*opts.standardYears
		if(sumInc >= totalRepayment && sumPay < totalRepayment){
			yearlyPayment = totalRepayment - sumPay
		}else{
			if(sumInc >= totalRepayment && sumPay >= totalRepayment){
				yearlyPayment = 0
			}else{
				yearlyPayment = incPay
			}
		}

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
	return [NPV, balance, incPay, yearlyPayment];

}

function PV(discountRate, years, standardRepayment){
	//Excel PV function found here https://support.office.com/en-us/article/PV-function-23879d31-0e02-4321-be01-da16e8168cbd
	//pv * (1+rate)^nper + pmt(1 + rate*type)* ( (1+rate)^nper -1  )/rate +fv = 0
	//fv = 0, type = 0 (payments due at end of period)
	var n = Math.pow(1 + discountRate, years)
	return (-1*standardRepayment* ((n - 1)/discountRate))/n

}

function buildOpts(o){
	var globals = getGlobals();
	var inputs = getInputs(o);


	var opts = $.extend(globals, inputs);
	var standardRepayment = getStandardRepayment(opts)

	opts["standardRepayment"] = standardRepayment
	opts["totalStandardRepayment"] = -PV(opts.discountRate, opts.standardYears, standardRepayment);

	return opts
}
function getYearsToRepay(o, agi){

	var opts = buildOpts(o)

	var yearMax = (opts.capAtStandardRepayment == true) ? MAX_YEARS : opts.forgivenessPeriod;
	

	for(var i = 0; i < yearMax; i++){
		var npv = getNPV(o, agi, i)[0]
		var balance = getNPV(o, agi, i)[1]
		if(npv <= .1 && balance <= .1){
			return i;
		}
	}
	return yearMax	
}

function getTotalRepayment(o, agi){
	var opts = buildOpts(o);
	
	var totalNPV = 0;
	var yearMax = (opts.capAtStandardRepayment == true) ? MAX_YEARS : opts.forgivenessPeriod;


	for(var i = 0; i < yearMax; i++){
		totalNPV += getNPV(o, agi, i)[0]
	}
	return totalNPV
	
}


function buildAllData(o){
	buildRepaymentData(o, function(dollarData){
		buildYearsData(o, function(yearData){
			var opts = buildOpts(o);

			// console.dir(opts)

		    var s = "adjusted_gross_income,total_repaid,years_to_repay,loan_amount,percent_discretionary_agi,forgiveness_period,minimum_payment,forgiveness_at_match_standard,annual_income_increase,poverty_level,discount_rate,inflation_rate,interest_rate,standard_repayment_fee,standard_number_of_years,standard_annual_payment,standard_total_payment_present_value"
		    s += "\r\n"

		    for(var i = 0; i < dollarData.length; i++){
		    	var agi = dollarData[i]["agi"];
		    	var npv = dollarData[i]["npv"];
		    	var yearDatum = yearData.filter(function(d){ return d["agi"] == agi });
		    	var years = yearDatum[0]["years"];

		    	var yearMax = (opts.capAtStandardRepayment == true) ? MAX_YEARS : opts.forgivenessPeriod;
		    	var match = (opts.capAtStandardRepayment == true) ? "YES" : "NO";
		    	s += agi + "," + npv + "," + years + "," + opts.loanAmount + "," + opts.percentDiscretionaryAGI + "," + yearMax + "," + opts.minPayment + "," + match + "," + opts.incomeIncrease + "," + opts.povertyLevel + "," + opts.discountRate + "," + opts.inflation + "," + opts.interestRate + "," + opts.standardFee + "," + opts.standardYears + "," + opts.standardRepayment + "," + opts.totalStandardRepayment;
		    	s += "\r\n"
		    }



		    var csvData = encodeURIComponent(s)
		    var encodedUri = 'data:Application/octet-stream,' + csvData;
		    d3.select('#downloadData a')
		        .attr('href', encodedUri)
		        .attr('download', 'tpc-simulator-results.csv');

		})
	})
}
function buildRepaymentData(o, callback){
	var data = []
	var opts = buildOpts(o);

	if(opts.forgivenessPeriod == MAX_YEARS){ disableForgiveness(opts.forgivenessPeriod) }
	else{ enableForgiveness(opts.forgivenessPeriod) }
	if(opts.capAtStandardRepayment == true){ disableForgiveness(opts.forgivenessPeriod) }
	else{ enableForgiveness(opts.forgivenessPeriod) }

	for(var agi = 5000; agi <= 120000; agi += 500){
		datum = {"agi": agi, "totalStandardRepayment": opts.totalStandardRepayment, "npv": getTotalRepayment(o, agi)}
		data.push(datum)
	}
	callback(data)

}
function buildRepaymentChart(o){
	var w = 500;
	var h = 500;
	var svg = d3.select("#repaymentChart").append("svg").attr("width", w).attr("height",h),
	    margin = {top: 20, right: 80, bottom: 30, left: 60},
	    width = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom,
	    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");


	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.npv); });

	buildRepaymentData(o, function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			200000
		]);


		var xAx = g.append("g")
		  .attr("class", "axis axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x).tickFormat(DOLLARS).tickValues([0,20000,40000,60000,80000,100000,120000]));
		xAx.selectAll(".tick text").attr("x", function(d){ return (d == 0) ? 15 : 0})
		xAx.selectAll(".tick line").attr("opacity", function(d){ return (d == 0) ? 0 : 1})

		var axis = g.append("g")
		  .attr("class", "axis axis--y")
		  .call(d3.axisLeft(y).tickSize(-width).tickFormat(DOLLARS))
		axis.append("text")
		  .attr("transform", "rotate(-90)")
		  .attr("y", 6)
		  .attr("dy", "0.71em")
		  .attr("fill", "#000")

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
		  	.text("Standard 10 year plan")
	})

}

function updateRepaymentChart(o){

	var svg = d3.select("#repaymentChart").select("svg")

	var w = 500;
	var h = 500;
	var	margin = {top: 20, right: 80, bottom: 30, left: 60},
	    width = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom;

	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.npv); });

	buildRepaymentData(o, function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			200000
		]);

		var axis = svg.selectAll(".axis.axis--y")
			.transition()
			.call(d3.axisLeft(y).tickSize(-width).tickFormat(DOLLARS))

		axis.selectAll(".tick text").attr("x", -6)
		axis.selectAll(".tick line").style("opacity", function(d){ return (d==0) ? 0 : 1})

		svg.selectAll(".repaymentLine.input")
		  .datum(data)
		  .transition()
		  .attr("d", line);

		svg.selectAll(".repaymentLine.fixed")
		  .datum(data)
		  .transition()
		  .attr("y1", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		  .attr("y2", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		svg.selectAll("#tenYearLabel")
			.datum(data)
			.transition()
			.attr("y", function(d){
		  		return y(d[0]["totalStandardRepayment"]) - 6
		  	})
	})

}




function buildYearsData(o, callback){
	var data = []
	var globals = getGlobals();
	var inputs = getInputs(o);

	var opts = $.extend(globals, inputs);

	for(var agi = 5000; agi <= 120000; agi += 500){
		datum = {"agi": agi, "years": getYearsToRepay(o, agi)}
		data.push(datum)
	}
	callback(data)

}
function buildYearsChart(o){
	var w = 500; //should be diff than yrs, bc margins diff
	var h = 500;
	var svg = d3.select("#yearsChart").append("svg").attr("width", w).attr("height",h),
	    margin = {top: 20, right: 80, bottom: 30, left: 20},
	    width = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom,
	    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");


	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.years); });

	buildYearsData(o, function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			60
		]);


		var xAx = g.append("g")
		  .attr("class", "axis axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x).tickFormat(DOLLARS).tickValues([0,20000,40000,60000,80000,100000,120000]));
		xAx.selectAll(".tick text").attr("x", function(d){ return (d == 0) ? 15 : 0})
		xAx.selectAll(".tick line").attr("opacity", function(d){ return (d == 0) ? 0 : 1})

		var axis = g.append("g")
		  .attr("class", "axis axis--y")
		  .call(d3.axisLeft(y).tickSize(-width))
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
function updateYearsChart(o){
	var svg = d3.select("#yearsChart").select("svg")

	var w = 500;
	var h = 500;
	var	margin = {top: 20, right: 80, bottom: 30, left: 20},
	    width = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom;

	var x = d3.scaleLinear().range([0, width]),
	    y = d3.scaleLinear().range([height, 0]);

	var line = d3.line()
	    // .curve(d3.curveBasis)
	    .x(function(d) { return x(d.agi); })
	    .y(function(d) { return y(d.years); });

	buildYearsData(o, function(data){
		x.domain(d3.extent(data, function(d) { return d.agi; }));

		y.domain([
			0,
			60
		]);

		var axis = svg.selectAll(".axis.axis--y")
			.transition()
			.call(d3.axisLeft(y).tickSize(-width))
		axis.selectAll(".tick text").attr("x", -6)
		axis.selectAll(".tick line").style("opacity", function(d){ return (d==0) ? 0 : 1})

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
      .attr("y2", "40%")
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
      .attr("stop-opacity", 0);

  svg.append("rect")
      .attr("class", "scrollFade gradient")
      .attr("x",0)
      .attr("y",0)
      .attr("width", 1200)
      .attr("height", 180)
      .attr("fill", "url(#gradient)")
}

function disableForgiveness(years){
	d3.select("#forgivenessPeriod").classed("disabled", true)
	d3.select(".controlContainer.forgivenessPeriod .valLabel").classed("disabled", true)
	d3.select(".controlContainer.forgivenessPeriod .suffix").classed("disabled", true)
	d3.select("#noForgiveness").classed("disabled", true)
	$("#forgivenessPeriod").val(50)
	$("#forgivenessPeriodLabel").val(50)
}
function enableForgiveness(years){
	if(years == 50){ return false}
	d3.select("#forgivenessPeriod").classed("disabled", false)
	d3.select(".controlContainer.forgivenessPeriod .valLabel").classed("disabled", false)
	d3.select(".controlContainer.forgivenessPeriod .suffix").classed("disabled", false)
	d3.select("#noForgiveness").classed("disabled", false)
}

function setPlan(o){
	// var dfd = $.Deferred();
	// dfd.done()
		// .
	// $("#percentDiscretionaryAGI").val(percentDiscretionaryAGI)
	// $("#percentDiscretionaryAGI")[0].input()
	updateCharts(o);	
	
}

function buildCharts(o){
	buildRepaymentChart(o);
	buildYearsChart(o);
	buildAllData(o);
	buildGradient(o);
}
function updateCharts(o){
	updateRepaymentChart(o);
	updateYearsChart(o);
	buildAllData(o);
}




d3.selectAll("#percentDiscretionaryAGI").on("input", function(){
	PREV_DATA = {}
	var val = parseFloat($(this).val())
	$(this.parentNode).find(".valLabel").val(parseInt(val*100))
	var o = {"percentDiscretionaryAGI":val, "minPayment":null, "forgivenessPeriod":null,"capAtStandardRepayment":null, "loanAmount": null}
	updateCharts(o)
})

d3.selectAll("#forgivenessPeriod").on("input", function(){
	PREV_DATA = {}
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").val(parseInt(val))
	var o = {"percentDiscretionaryAGI":null, "minPayment":null, "forgivenessPeriod":val,"capAtStandardRepayment":null, "loanAmount": null}
	updateCharts(o)
})
d3.selectAll("#minPayment").on("input", function(){
	PREV_DATA = {}
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").val(parseInt(val))
	var o = {"percentDiscretionaryAGI":null, "minPayment":val, "forgivenessPeriod":null,"capAtStandardRepayment":null, "loanAmount": null}
	updateCharts(o)
})
d3.selectAll("#loanAmount").on("input", function(){
	PREV_DATA = {}
	var formatter = d3.format("$,.0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))
	var o = {"percentDiscretionaryAGI":null, "minPayment":null, "forgivenessPeriod":null,"capAtStandardRepayment":null, "loanAmount": val}
	$("#yearsTitle").find(".valLabel").text(formatter(val))
	$("#loanAmount2").val(val)
	updateCharts(o)
})
d3.selectAll("#loanAmount2").on("input", function(){
	PREV_DATA = {}
	var formatter = d3.format("$,.0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))
	var o = {"percentDiscretionaryAGI":null, "minPayment":null, "forgivenessPeriod":null,"capAtStandardRepayment":null, "loanAmount": val}
	$("#repaymentTitle").find(".valLabel").text(formatter(val))
	$("#loanAmount").val(val)
	updateCharts(o)
})
d3.selectAll("#capAtStandardRepayment").on("change", function(){
	PREV_DATA = {}
	var o = {"percentDiscretionaryAGI":null, "minPayment":null, "forgivenessPeriod":null,"capAtStandardRepayment":val, "loanAmount": null}
	var val = document.getElementById("capAtStandardRepayment").checked
	updateCharts(o)	
})

d3.select("#repayeUndergrad").on("click", function(){
	PREV_DATA = {}
	var o = {"percentDiscretionaryAGI":.1, "minPayment":0, "forgivenessPeriod":20,"capAtStandardRepayment":false, "loanAmount": null}
	setPlan(o)
})

d3.select("#clickToExpand").on("click", function(){
	if(d3.select(this).classed("closed")){
		d3.select(this).classed("closed", false)
		d3.select("#topText")
			.transition()
			.style("height", "1000px")
	}else{
		d3.select(this).classed("closed", true)
		d3.select("#topText")
			.transition()
			.style("height", "400px")

	}
})
var INIT = {"percentDiscretionaryAGI":null, "minPayment":null, "forgivenessPeriod":null,"capAtStandardRepayment":null, "loanAmount": null}
buildCharts(INIT)