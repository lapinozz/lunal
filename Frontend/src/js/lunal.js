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

	initOption()
	{
		const rollings = [1, 2, 3, 5, 10, 20, 30, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

		this.options = {
			symbol: {
				type: 'select',
				default: 'ETHBTC', 
			},
			interval: {
				type: 'select',
				default: '5m',
				values: klineIntervals
			},
			rollingWindow: {
				type: 'select',
				default: 5,
				values: rollings,
				name: 'Rolling Window'
			},
		};

		const header = $('.page-header');

		for(const id in this.options)
		{
			const option = this.options[id];
			option.id = id;

			if(!option.name)
			{
				option.name = id.charAt(0).toUpperCase() + id.slice(1);
			}

			const optionContainer = $('<div>');
			optionContainer.addClass('option-container');
			header.append(optionContainer);

			const optionLabel = $('<div>');
			optionContainer.append(optionLabel);
			optionLabel.addClass('option-label');
			optionLabel.text(option.name);

			if(option.type == 'select')
			{
				option.div = $('<select>');
				optionContainer.append(option.div);
				option.div.change(() => {
					const value = option.div.val();
					this.setOptionValue(id, value, true);
				});
			}

			if(option.values)
			{
				this.setOptionValues(id, option.values);
			}

			option.savedValue = localStorage.getItem('option-' + id);
			if(option.savedValue || option.default)
			{
				this.setOptionValue(id, option.savedValue || option.default, true);
			}
		}
		
		const resetButton = $('<button>');
		resetButton.text('Reset');
		resetButton.addClass('reset');
		header.append(resetButton);
		resetButton.click(() => {
			for(const id in this.options)
			{
				const option = this.options[id];

				if(option.default)
				{
					this.setOptionValue(id, option.default, true);
				}
			}
		});
	}

	getOptionValue(id)
	{
		const option = this.options[id];
		if(!option) return undefined;

		return option.value;
	}

	setOptionValues(id, values)
	{
		const option = this.options[id];
		if(!option) return;

		if(option.type = 'select')
		{
			option.div.html('');
			option.div.append(values.map(v => {
				const option = $("<option>");
				option[0].value = v;
				option[0].name = v;
				option[0].label = v;
				return option;
			}))
		}

		if(option.value)
		{
			this.setOptionValue(id, option.value, true);
		}
	}

	setOptionValue(id, value, triggerChange = false)
	{
		const option = this.options[id];
		if(!option) return;

		const prevVal = option.value;
		option.value = value;

		if(option.type = 'select')
		{
			option.div.val(value);
		}

		if(triggerChange)
		{
			this.onOptionChanged(id, prevVal, value);
		}
	}

	onOptionChanged(id, prevVal, value)
	{
		localStorage.setItem('option-' + id, value);

		if(id == 'symbol' || id == 'interval')
		{
			this.fetchData();
		}
		else if(id == 'rollingWindow')
		{
			this.updateChart();
		}	
	}

	buildPage()
	{
		const body = document.body;
	}

	query(obj)
	{
		if(this.ws && this.ws.readyState === WebSocket.OPEN)
		{
			this.ws.send(JSON.stringify(obj));
		}
	}

	fetchData()
	{
		this.query({
			type: MSG_KLINES,
			symbol: this.getOptionValue('symbol'),
			interval: this.getOptionValue('interval') 
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

			for(const s of this.exchangeInfo.symbols)
			{
				const symbol = new Symbol(s);
				this.symbols[symbol.name] = symbol;
			}

			this.setOptionValues('symbol', Object.keys(this.symbols).sort());
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

	updateSeriesVisibility()
	{
		const chart = this.chart;
		if(!chart) return;

		const hiddens = JSON.parse(localStorage.getItem('hiddenSeries') || '[]');

		setTimeout(() => {
			for(const series of chart.w.globals.seriesNames)
			{
				if(hiddens.includes(series))
				{
					chart.hideSeries(series);
				}
				else
				{
					chart.showSeries(series);
				}
			}
		});
	}

	updateChart()
	{
		if(!this.chart)
		{
			this.chart = new ApexCharts($(".main-chart-parent")[0], defaultChartOptions);
			this.chart.render();
			this.chart.updateOptions({
				chart: {
					events: {
						legendClick: (ctx, index, config) => {
							const name = config.config.series[index].name;

							let hiddens = JSON.parse(localStorage.getItem('hiddenSeries') || '[]');

							let visible = hiddens.includes(name);

							hiddens = hiddens.filter(h => h != name);
							if(!visible)
							{
								hiddens.push(name);
							}

							localStorage.setItem('hiddenSeries', JSON.stringify(hiddens));
							this.updateSeriesVisibility();
						}
					}
				}
			});
		}

		console.time('updateChart');

		const interval = this.getOptionValue('interval');
		const symbol = this.getSymbol(this.getOptionValue('symbol'));
		const rollingAverageLength = parseInt(this.getOptionValue('rollingWindow'));

		console.log('things', symbol, interval, rollingAverageLength)

		const {bot} = this;

		bot.setSymbol(symbol);
		bot.setInterval(interval);
		bot.setRollingAverageLength(rollingAverageLength);

		const chartData = bot.update();
		console.timeEnd('updateChart');

		console.time('drawChart');
		this.chart.updateOptions(bot.makeChartData());
		this.updateSeriesVisibility();
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

		this.fetchData();
	}

	constructor()
	{
		bindPrototypeMethods(this);

		this.bot = new Bot();

		this.initOption();
		this.buildPage();

		this.ws = new WebSocket("ws://localhost:8080/echo");
		this.ws.onmessage = this.onMessage;
		this.ws.onopen = this.onConnectionOpen;
		this.ws.onerror = this.onConnectionClose;
		this.ws.onclose = this.onConnectionClose;
	}
}