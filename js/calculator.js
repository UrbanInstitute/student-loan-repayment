var PREV_BALANCE;

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
	inputs.percentDiscretionaryAGI = parseFloat($("#percentDiscretionaryAGI").val())
	inputs.forgivenessPeriod = parseFloat($("#forgivenessPeriod").val())
	inputs.loanAmount = parseFloat($("#loanAmount").val())
	inputs.capAtStandardRepayment = document.getElementById("capAtStandardRepayment").checked;
	inputs.minPayment = parseFloat($("#minPayment").val());

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
		if(opts.standardRepayment < inc && opts.capAtStandardRepayment == true){
			incPay = opts.standardRepayment
		}else{
			incPay = inc;
		}
	}
	var prevBalance = (year == 0) ? loanAmount : PREV_BALANCE;
	var balance = prevBalance * (1+(opts.interestRate)) - incPay

	PREV_BALANCE = balance;

	var yearlyPayment, yearlyUnbounded;
	yearlyUnbounded = (balance > 0) ? incPay : incPay + balance;
	yearlyPayment = (yearlyUnbounded < 0) ? 0 : yearlyUnbounded;

	var NPV = yearlyPayment / Math.pow(1+opts.discountRate, year+1)
	
	return NPV;
}

function getYearsToRepay(agi){
	var globals = getGlobals();
	var inputs = getInputs();

	var opts = $.extend(globals, inputs);
	var standardRepayment = getStandardRepayment(opts)

	opts["standardRepayment"] = standardRepayment
	opts["totalStandardRepayment"] = standardRepayment * opts.standardYears;
	
	var totalNPV = 0;

	for(var i = 0; i < opts.forgivenessPeriod; i++){
		var npv = getNPV(agi, i, opts)
		if(npv <= .1){
			return i;
		}
	}
	return opts.forgivenessPeriod
	
}

function getTotalRepayment(agi){
	var globals = getGlobals();
	var inputs = getInputs();

	var opts = $.extend(globals, inputs);
	var standardRepayment = getStandardRepayment(opts)

	opts["standardRepayment"] = standardRepayment
	opts["totalStandardRepayment"] = standardRepayment * opts.standardYears;
	
	var totalNPV = 0;

	for(var i = 0; i < opts.forgivenessPeriod; i++){
		totalNPV += getNPV(agi, i, opts)
	}
	return totalNPV
	
}

function buildRepaymentData(callback){
	var data = []
	var globals = getGlobals();
	var inputs = getInputs();

	var opts = $.extend(globals, inputs);
	var totalStandardRepayment = getStandardRepayment(opts) * opts.standardYears

	for(var agi = 5000; agi <= 120000; agi += 500){
		datum = {"agi": agi, "totalStandardRepayment": totalStandardRepayment, "npv": getTotalRepayment(agi)}
		data.push(datum)
	}
	callback(data)


//////////////////////////////////TO BE BALETED
	var formatter = d3.format("$,.2f")
	d3.select("#repaymentChart").selectAll(".trash").remove()
	d3.select("#repaymentChart").append("div").text("10 year: " + formatter(totalStandardRepayment)).attr("class", "trash")
	var table = d3.select("#repaymentChart").append("table").attr("class","trash")

	var h = table.append("tr")
	h.append("th").text("AGI")
	h.append("th").text("Repayed")

	var tr = table
		.selectAll("tr")
		.data(data)
		.enter()
		.append("tr")
	tr.append("td").text(function(d){ return formatter(d.agi)})
	// tr.append("td").text(function(d){ return formatter(d.totalStandardRepayment)})
	tr.append("td").text(function(d){ return formatter(d.npv)})
//////////////////////////////////END BALETED
}
function buildRepaymentChart(){
	var w = 500;
	var h = 500;
	var svg = d3.select("#repaymentChart").append("svg").attr("width", w).attr("height",h),
	    margin = {top: 20, right: 80, bottom: 30, left: 50},
	    width = w - margin.left - margin.right,
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
			200000
		]);


		g.append("g")
		  .attr("class", "axis axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x));

		g.append("g")
		  .attr("class", "axis axis--y")
		  .call(d3.axisLeft(y))
		.append("text")
		  .attr("transform", "rotate(-90)")
		  .attr("y", 6)
		  .attr("dy", "0.71em")
		  .attr("fill", "#000")


		g.append("path")
		  .datum(data)
		  .attr("fill", "none")
		  .attr("class", "repaymentLine input")
		  .attr("stroke", "steelblue")
		  .attr("stroke-linejoin", "round")
		  .attr("stroke-linecap", "round")
		  .attr("stroke-width", 1.5)
		  .attr("d", line);

		g.append("line")
		  .datum(data)
		  .attr("fill", "none")
  		  .attr("class", "repaymentLine fixed")
		  .attr("stroke", "steelblue")
		  .attr("x1", x(5000))
		  .attr("x2", width)
		  .attr("y1", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
		  .attr("y2", function(d){
		  	return y(d[0]["totalStandardRepayment"])
		  })
	})

}

function updateRepaymentChart(){
	var svg = d3.select("#repaymentChart").select("svg")

	var w = 500;
	var h = 500;
	var	margin = {top: 20, right: 80, bottom: 30, left: 50},
	    width = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom;

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
			200000
		]);

		svg.selectAll(".axis.axis--y")
			.transition()
			.call(d3.axisLeft(y))

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
	})

}




function buildYearsData(callback){
	var data = []
	var globals = getGlobals();
	var inputs = getInputs();

	var opts = $.extend(globals, inputs);

	for(var agi = 5000; agi <= 120000; agi += 500){
		datum = {"agi": agi, "years": getYearsToRepay(agi)}
		data.push(datum)
	}
	callback(data)

//////////////////////////////////TO BE BALETED
	var formatter = d3.format("$,.2f")
	var years = d3.format(".0f")
	d3.select("#yearsChart").selectAll(".trash").remove()
	var table = d3.select("#yearsChart").append("table").attr("class","trash")

	var h = table.append("tr")
	h.append("th").text("AGI")
	h.append("th").text("Years")

	var tr = table
		.selectAll("tr")
		.data(data)
		.enter()
		.append("tr")
	tr.append("td").text(function(d){ return formatter(d.agi)})
	// tr.append("td").text(function(d){ return formatter(d.totalStandardRepayment)})
	tr.append("td").text(function(d){ return years(d.years)})
//////////////////////////////////END BALETED

}
function buildYearsChart(){
	var w = 500;
	var h = 500;
	var svg = d3.select("#yearsChart").append("svg").attr("width", w).attr("height",h),
	    margin = {top: 20, right: 80, bottom: 30, left: 50},
	    width = w - margin.left - margin.right,
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
			100
		]);


		g.append("g")
		  .attr("class", "axis axis--x")
		  .attr("transform", "translate(0," + height + ")")
		  .call(d3.axisBottom(x));

		g.append("g")
		  .attr("class", "axis axis--y")
		  .call(d3.axisLeft(y))
		.append("text")
		  .attr("transform", "rotate(-90)")
		  .attr("y", 6)
		  .attr("dy", "0.71em")
		  .attr("fill", "#000")


		g.append("path")
		  .datum(data)
		  .attr("fill", "none")
		  .attr("class", "yearsLine")
		  .attr("stroke", "steelblue")
		  .attr("stroke-linejoin", "round")
		  .attr("stroke-linecap", "round")
		  .attr("stroke-width", 1.5)
		  .attr("d", line);

	})

}
function updateYearsChart(){
	var svg = d3.select("#yearsChart").select("svg")

	var w = 500;
	var h = 500;
	var	margin = {top: 20, right: 80, bottom: 30, left: 50},
	    width = w - margin.left - margin.right,
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
			100
		]);

		svg.selectAll(".axis.axis--y")
			.transition()
			.call(d3.axisLeft(y))

		svg.selectAll(".yearsLine")
		  .datum(data)
		  .transition()
		  .attr("d", line);

	})

}



function buildCharts(){
	buildRepaymentChart();
	buildYearsChart();
}
function updateCharts(){
	updateRepaymentChart();
	updateYearsChart();
}




d3.selectAll("#percentDiscretionaryAGI").on("input", function(){
	var formatter = d3.format(".1%")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))
	updateCharts()
})

d3.selectAll("#forgivenessPeriod").on("input", function(){
	var formatter = d3.format(".0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))
	updateCharts()
})
d3.selectAll("#minPayment").on("input", function(){
	var formatter = d3.format("$.0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))
	updateCharts()
})
d3.selectAll("#loanAmount").on("input", function(){
	var formatter = d3.format("$,.0f")
	var val = $(this).val()
	$(this.parentNode).find(".valLabel").text(formatter(val))
	updateCharts()
})
d3.selectAll("#capAtStandardRepayment").on("change", function(){
	updateCharts()	
})
buildCharts()