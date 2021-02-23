import ApexCharts from 'apexcharts'
window.ApexCharts = ApexCharts;

import defaultChartOptions from './defaultChartOptions';

import {bindPrototypeMethods} from './utils';

import {klineIntervals} from './consts';

import Symbol from './symbol';

import Bot from './bot';

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
		const interval = this.intervalSelect[0].value;
		const symbol = this.getSymbol(this.symbolSelect[0].value);
		const rollingAverageLength = parseInt(this.rollingAverageSelect[0].value);

		console.log('things', symbol, interval, rollingAverageLength)

		const {bot} = this;

		bot.setSymbol(symbol);
		bot.setInterval(interval);
		bot.setRollingAverageLength(rollingAverageLength);

		const chartData = bot.update();
		
		console.timeEnd('updateChart');

		console.log(chartData)

		console.time('drawChart');
		this.chart.updateOptions(bot.makeChartData());
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

		this.bot = new Bot();

		this.buildPage();

		this.ws = new WebSocket("ws://localhost:8080/echo");
		this.ws.onmessage = this.onMessage;
		this.ws.onopen = this.onConnectionOpen;
		this.ws.onerror = this.onConnectionClose;
		this.ws.onclose = this.onConnectionClose;
	}
}