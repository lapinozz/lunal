import ApexCharts from 'apexcharts'
window.ApexCharts = ApexCharts;

import defaultChartOptions from './defaultChartOptions';

import {bindPrototypeMethods} from './utils';

import {klineIntervals} from './consts';

import Symbol from './symbol';

const MSG_FEES = 'fees';
const MSG_KLINES = 'klines';
const MSG_EXCHANGE_INFO = 'exchange-info';

export default class Lunal
{
	symbols = [];

	getSetting(name)
	{
		const settings = JSON.parse(localStorage.getItem('settings') || '{}');
		return settings[name];
	}

	setSetting(name, value)
	{
		const settings = JSON.parse(localStorage.getItem('settings') || '{}');
		settings[name] = value;
		localStorage.setItem('settings', JSON.stringify(settings))
	}

	getSymbol(name)
	{
		return this.symbols[name];
	}

	buildPage()
	{
		const body = document.body;

		this.symbolSelect = $("<select>");
		this.symbolSelect.change(this.fetchData);
		$(body).append(this.symbolSelect);
		
		this.intervalSelect = $("<select>");
		this.intervalSelect.change(this.fetchData);
		$(body).append(this.intervalSelect);
		this.intervalSelect.append(klineIntervals.map(i => {
			const option = $("<option>");
			option[0].value = i;
			option[0].name = i;
			option[0].label = i;
			return option;
		}));
		this.intervalSelect.val(klineIntervals[2]);
		
		this.rollingAverageSelect = $("<select>");
		this.rollingAverageSelect.change(this.updateChart);
		$(body).append(this.rollingAverageSelect);
		const rollings = [1, 2, 3, 5, 10, 20, 30, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
		this.rollingAverageSelect.append(rollings.map(i => {
			const option = $("<option>");
			option[0].value = i;
			option[0].name = i;
			option[0].label = i;
			return option;
		}));
		this.rollingAverageSelect.val(5);

		this.chartDiv = $("<div>");
		$(body).append(this.chartDiv);

		this.chart = new ApexCharts(this.chartDiv[0], defaultChartOptions);
		this.chart.render();
	}

	query(obj)
	{
		this.ws.send(JSON.stringify(obj));
	}

	fetchData()
	{
		this.query({
			type: MSG_KLINES,
			symbol: this.symbolSelect[0].value,
			interval: this.intervalSelect[0].value 
		});
	}

	onMessage(evt)
	{
		const msg = JSON.parse(evt.data);

		const header = msg[0];
		const data = msg[1];

		const {type} = header;

		if(type == MSG_EXCHANGE_INFO)
		{
			this.exchangeInfo = data;

			console.log(this.exchangeInfo)

			for(const s of this.exchangeInfo.symbols)
			{
				const symbol = new Symbol(s);
				this.symbols[symbol.name] = symbol;
			}

			const symbols = this.exchangeInfo.symbols.map(e => e.symbol).sort();
			this.symbolSelect.html('');
			this.symbolSelect.append(Object.keys(this.symbols).map(s => {
				const option = $("<option>");
				option[0].value = s;
				option[0].name = s;
				option[0].label = s;
				return option;
			}))
			this.symbolSelect[0].value = "ETHBTC";
			this.symbolSelect.change();
			console.timeEnd('symbols');
		}
		else if(type == MSG_FEES)
		{
			for(const feeData of (data.tradeFee || []))
			{
				const symbol = this.getSymbol(feeData.symbol);
				if(symbol)
				{
					symbol.setFees(feeData);
				}
			}
			console.log(data)

			this.updateChart();
		}
		else if(type == MSG_KLINES)
		{
			const symbol = this.getSymbol(header.symbol);
			if(symbol)
			{
				symbol.appenKlines(header.interval, data);
			}

			this.updateChart();
		}
	}

	updateChart()
	{
		console.time('updateChart');
		const series = [];

		const annotations = {
			yaxis: [],
			xaxis: [],
			points: []
		};

		const symbol = this.getSymbol(this.symbolSelect[0].value);
		if(!symbol) return;

		const klines = symbol.getKlines(this.intervalSelect[0].value);

		const rollingAverageLength = parseInt(this.rollingAverageSelect[0].value);

		const diffRollingAverageLength = 5;

		const avgOverTime = [];
		const valueOverTime = [];
		const rollingAvg = [];
		const rollingValues = [];
		const diffOverTime = [];
		const diffRollingOverTime = [];
		const weightedAvg = []
		const capOverTime = []
		const moneyOverTime = [];
		const volumeOverTime = [];
		const magnitudeOverTime = [];

		let minVal = Infinity;
		let minValTime = undefined;
		let maxGap = -Infinity;

		let buyTime = undefined;
		let sellTime = undefined;
		let buyVal = undefined;
		let sellVal = undefined;

		let money = undefined;
		let currency = undefined;
		let lastTransaction = undefined;
		let lastCap = undefined;

		let avg = 0;

		let dir = 0;

		for(const k of klines)
		{
			const val = (k.open + k.close) / 2;
			avg += val;

			valueOverTime.push([k.openTime, val])
			avgOverTime.push([k.openTime, avg / (avgOverTime.length + 1)])

			if(diffOverTime.length >= diffRollingAverageLength)
			{
				diffRollingOverTime.push([k.openTime, diffOverTime.slice(-diffRollingAverageLength).reduce((a, b) => a + b[1], 0) / diffRollingAverageLength]);
			}

			rollingValues.unshift(val);
			while(rollingValues.length > rollingAverageLength)
			{
				rollingValues.pop();
			}
			rollingAvg.push([k.openTime, rollingValues.reduce((a, b) => a + b, 0) / rollingValues.length]);

			if(rollingValues.length >= rollingAverageLength)
			{
				weightedAvg.push([k.openTime, valueOverTime.slice(-rollingAverageLength).reduce((a, b) => ((a + b[1]) / 2), avg / valueOverTime.length)]);
				//console.log(valueOverTime.slice(-rollingAverageLength))
			}

			if(weightedAvg.length > 5)
			{
				//const rolAvg1 = rollingAvg[rollingAvg.length - 1][1];
				//const rolAvg2 = rollingAvg[rollingAvg.length - 2][1];

				//const rolAvg1 = valueOverTime[valueOverTime.length - 1][1];
				//const rolAvg2 = valueOverTime[valueOverTime.length - 2][1];

				const rolAvg1 = weightedAvg[weightedAvg.length - 1][1];
				const rolAvg2 = weightedAvg[weightedAvg.length - 2][1];

				if(lastTransaction === undefined)
				{
					lastTransaction = rolAvg1;
					lastCap = lastTransaction;
				}

				if(diff < 0 && dir != -1)
				{
					lastCap = Math.min(rolAvg1, lastCap);
				}
				else if(diff > 0 && dir != 1)
				{
					lastCap = Math.max(rolAvg1, lastCap);
				}

				diffOverTime.push([k.openTime, rolAvg1 / rolAvg2]);

				const diff = rolAvg1 - rolAvg2;
				const transDiff = rolAvg1 - lastTransaction;
				const magn = Math.max(rolAvg1, lastTransaction) / Math.min(rolAvg1, lastTransaction);

				//magnitudeOverTime.push([k.openTime, magn]);

				const capDiff = rolAvg1 - lastCap;
				const capDiffAbs = Math.abs(capDiff);
				const transDiffAbs = Math.abs(transDiff);
				const capDiffRatio = capDiffAbs == 0 ? 1 : Math.min(capDiffAbs, transDiffAbs) / Math.max(capDiffAbs, transDiffAbs);
				const capDiffRatioRel = capDiffAbs == 0 ? 1 : capDiffAbs / transDiffAbs;
				const capRatio = Math.min(lastCap, rolAvg1) / Math.max(lastCap, rolAvg1);
				const capRatioRel = lastCap / rolAvg1;
				const capMagn = Math.min(lastCap, lastTransaction) / Math.max(lastCap, lastTransaction);
				const capMagnRel = lastCap / lastTransaction;

				const lostSignificance = capDiffAbs == 0 || transDiffAbs == 0 ? 1 : transDiffAbs / capDiffAbs;

				magnitudeOverTime.push([k.openTime, capMagnRel]);
				//magnitudeOverTime.push([k.openTime, capRatioRel]);

				let shouldSell = diff < 0 && magn > 1.0005 && dir != 1;
				let shouldBuy = diff > 0 && magn > 1.0005 && dir != -1;

				//console.log(dir, capRatioRel)

				shouldSell = dir != 1 && capDiffRatioRel < 1;
				shouldBuy = dir != -1 && capDiffRatioRel < 1;

				const significant = transDiffAbs != 0 && capDiffAbs / transDiffAbs > 20;

				const capMagnThresh = 0.003;

				shouldSell = dir != 1 && ((diff < 0 && capMagnRel > (1 + capMagnThresh)) || (diff < 0 && significant));
				shouldBuy = dir != -1 && ((diff > 0 && capMagnRel < (1 - capMagnThresh)) || (diff > 0 && significant));

				if(shouldSell)
				{
					//console.log("up")

					if(money === undefined)
					{
						money = 1;
						currency = 0;
					}
					else
					{
						money += (currency * val) * 0.999;
						currency = 0;
					}

					lastTransaction = rolAvg1;
					lastCap = lastTransaction;

					dir = 1;
					annotations.points.push({
						x: k.openTime,
						y: val,
				        strokeDashArray: 0,
				        borderColor: "#775DD0",
				        label: {
				          borderColor: "#775DD0",
				          style: {
				            color: "#fff",
				            background: "#775DD0"
				          },
				          text: "up"
				        }
					});
				}
				else if(shouldBuy)
				{
					//console.log("down", d[0], avg)

					if(money === undefined)
					{
						currency = 1 / val;
						money = 0;
					}
					else
					{
						currency += (money / val) * 0.999;
						money = 0;
					}

					lastTransaction = rolAvg1;
					lastCap = lastTransaction;

					dir = -1;
					annotations.points.push({
						x: k.openTime,
						y: val,
				        strokeDashArray: 0,
				        borderColor: "#775DD0",
				        label: {
				          borderColor: "#775DD0",
				          style: {
				            color: "#fff",
				            background: "#775DD0"
				          },
				          text: "down"
				        }
					});
				}

				capOverTime.push([k.openTime, lastCap]);
			}

			if(money !== undefined)
			{
				moneyOverTime.push([k.openTime, money == 0 ? currency * val : money]);
			}

			if(val < minVal)
			{
				minVal = val;
				minValTime = k.openTime;
			}

			const gap = val - minVal;
			if(gap > maxGap)
			{
				maxGap = gap;
				buyTime = minValTime;
				sellTime = k.openTime;
				buyVal = minVal;
				sellVal = val;
			}
		}

		if(currency > 0)
		{
			const k = klines[klines.length - 1];
			const val = k.avg;

			money = currency * val;
			currency = 0;
		}

		console.log({money, currency})

		annotations.points.push({
			x: buyTime,
			y: buyVal,
	        strokeDashArray: 0,
	        borderColor: "#775DD0",
	        label: {
	          borderColor: "#775DD0",
	          style: {
	            color: "#fff",
	            background: "#775DD0"
	          },
	          text: "buy"
	        }
		});

		annotations.points.push({
			x: sellTime,
			y: sellVal,
	        strokeDashArray: 0,
	        borderColor: "#775DD0",
	        label: {
	          borderColor: "#775DD0",
	          style: {
	            color: "#fff",
	            background: "#775DD0"
	          },
	          text: "Sell " + (sellVal / buyVal)
	        }
		});

		annotations.yaxis.push({
			y: avg / klines.length,
	        strokeDashArray: 0,
	        borderColor: "#775DD0",
	        label: {
	          borderColor: "#775DD0",
	          style: {
	            color: "#fff",
	            background: "#775DD0"
	          },
	          text: "Average"
	        }
		});

		console.log(klines)

		false && series.push({
			name: 'sales',
			type: 'candlestick',
			data: klines.map(k => [
					k.openTime,
					k.open,
					k.high,
					k.low,
					k.close
				])
		});

		true && series.push({
			name: 'value',
			type: 'line',
			data: valueOverTime
		});

		false && series.push({
			name: 'rolling average',
			type: 'line',
			data: rollingAvg
		});

		true && series.push({
			name: 'weighted average',
			type: 'line',
			data: weightedAvg
		});

		true && series.push({
			name: 'last cap',
			type: 'line',
			data: capOverTime
		});

		false && series.push({
			name: 'diff over time',
			type: 'line',
			data: diffOverTime,
			side: "opposite"
		});

		false && series.push({
			name: 'diff rolling avg',
			type: 'line',
			data: diffRollingOverTime,
			side: "opposite"
		});

		true && series.push({
			name: 'magn',
			type: 'line',
			data: magnitudeOverTime,
			side: "opposite"
		});

		true && series.push({
			name: 'money',
			type: 'line',
			data: moneyOverTime,
			side: "opposite"
		});

		let leftName = undefined;
		let rightName = undefined;

		let minLeft = Infinity;
		let maxLeft = -Infinity;

		let minRight = Infinity;
		let maxRight = -Infinity;

		for(const s of series)
		{
			if(s.side == "opposite")
			{
				for(const d of s.data)
				{
					minRight = Math.min(minRight, d[1]);
					maxRight = Math.max(maxRight, d[1]);
				}
			}
			else
			{
				for(const d of s.data)
				{
					minLeft = Math.min(minLeft, d[1]);
					maxLeft = Math.max(maxLeft, d[1]);
				}
			}
		}

		const spanLeft = maxLeft - minLeft;
		const spanRight = maxRight - minRight;

		maxLeft += spanLeft * 0.05;
		minLeft -= spanLeft * 0.05;

		maxRight += spanRight * 0.05;
		minRight -= spanRight * 0.05;

		console.log({minLeft, maxLeft, minRight, maxRight})

		const yaxis = series.map(s => {
			const obj = {};

			if(s.side == "opposite")
			{	
				obj.opposite = true;
				rightName = rightName || s.name;
				obj.show = rightName == s.name;
				obj.seriesName = rightName;
				obj.min = minRight;
				obj.max = maxRight;
			}
			else
			{
				leftName = leftName || s.name;
				obj.show = leftName == s.name;
				obj.seriesName = leftName;
				obj.min = minLeft;
				obj.max = maxLeft;
			}

			return obj;
		});
		
		console.timeEnd('updateChart');

		console.time('drawChart');
		this.chart.updateOptions({
			series,
			annotations,
			yaxis
		});
		console.timeEnd('drawChart');
	}

	onConnectionClose(event)
	{
    	window.location.reload();
	}

	onConnectionOpen()
	{
		console.time('symbols');
		this.query({
			type: MSG_EXCHANGE_INFO,
		});
		this.query({
			type: MSG_FEES,
			timestamp: Date.now() + ""
		});
	}

	constructor()
	{
		bindPrototypeMethods(this);

		this.buildPage();

		this.ws = new WebSocket("ws://localhost:8080/echo");
		this.ws.onmessage = this.onMessage;
		this.ws.onopen = this.onConnectionOpen;
		this.ws.onerror = this.onConnectionClose;
		this.ws.onclose = this.onConnectionClose;
	}
}