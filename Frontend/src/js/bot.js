import {klineIntervals} from './consts';

const DIR_UP = 1;
const DIR_SAME = 0;
const DIR_DOWN = -1;

export default class Bot
{
	rollingAverageLength = undefined;
	interval = undefined;
	symbol = undefined;

	frames = [];

	constructor(config)
	{
		this.reset();
	}

	reset()
	{
		this.frames = [];
	}

	setRollingAverageLength(value)
	{
		if(this.rollingAverageLength !== value)
		{
			this.reset();
		}

		this.rollingAverageLength = value;
	}

	setInterval(value)
	{
		if(this.interval !== value)
		{
			this.reset();
		}

		this.interval = value;
	}

	setSymbol(value)
	{
		if(this.symbol !== value)
		{
			this.reset();
		}

		this.symbol = value;
	}

	update()
	{
		const {symbol, interval, rollingAverageLength} = this;
		const diffRollingAverageLength = 5;

		if(!symbol || !rollingAverageLength || !interval) return;

		const klines = symbol.getKlines(interval);
		if(!klines) return;

		const fee = symbol.fees.taker;
		if(!fee) return;

		const feeInverse = 1 - fee;

		let money = 1;
		let coins = 0;

		this.reset();
		const frames = this.frames;

		const transactions = [];
		const buys = [];
		const sells = [];

		const buy = (time, price, percent = 1) => 
		{
			const moneyExchanged = money * percent;
			coins += (moneyExchanged / price) * feeInverse;
			money -= moneyExchanged;

			lastCap = price;

			const transaction = {
				time,
				price,
				money,
				coins,
				value: coins * price + money,
				type: 'buy'
			};

			buys.push(transaction);
			transactions.push(transaction);
		}
 
		const sell = (time, price, percent = 1) => 
		{
			const coinsExchanged = coins * percent;
			money += (coinsExchanged * price) * feeInverse;
			coins -= coinsExchanged;

			lastCap = price;

			const transaction = {
				time,
				price,
				money,
				coins,
				value: coins * price + money,
				type: 'sell'
			};

			const lastTransaction = transactions[ transactions.length - 1];
			if(lastTransaction)
			{
				transaction.gainRatio = transaction.value / lastTransaction.value;
				transaction.win = transaction.value > lastTransaction.value;
				transaction.loss = transaction.win;
			}

			sells.push(transaction);
			transactions.push(transaction);
		}

		let lastCap = undefined;

		let avg = 0;

		const extremums = [];
		const ups = [];
		const downs = [];

		const SMA = require('technicalindicators').SMA;
		const EMA = require('technicalindicators').EMA;
		const ADX = require('technicalindicators').ADX;
		const WMA = require('technicalindicators').WMA;
		const BULLISH = require('technicalindicators').bullish;
		
		const adxPeriod = 10;
		const adx = new ADX({period: adxPeriod, close: [], low: [], high: []});

		const smaFastPeriod = 20;
		const smaSlowPeriod = 45;

		const emaFastPeriod = 20;
		const emaSlowPeriod = 45;

		for(const k of klines)
		{
			const lastFrame = frames[frames.length - 1];

			const frame = {...k, annotations: []};
			frames.push(frame);

			frame.rollingAvg = frames.slice(-rollingAverageLength).reduce((a, b) => a + b.avg, 0) / rollingAverageLength;
			frame.weightedAvg = frames.slice(-rollingAverageLength).reduce((a, b) => (a + b.avg) / 2, frame.avg);

			frame.smaFast = SMA.calculate({period: smaFastPeriod, values: frames.slice(-smaFastPeriod).map(f => f.avg)})[0];
			frame.smaSlow = SMA.calculate({period: smaSlowPeriod, values: frames.slice(-smaSlowPeriod).map(f => f.avg)})[0];

			frame.emaFast = WMA.calculate({period: emaFastPeriod, values: frames.slice(-emaFastPeriod).map(f => f.avg)})[0];
			frame.emaSlow = WMA.calculate({period: emaSlowPeriod, values: frames.slice(-emaSlowPeriod).map(f => f.avg)})[0];

			const smaFastP = Math.min(frames.length, smaFastPeriod);
			const smaSlowP = Math.min(frames.length, smaSlowPeriod);
			frame.smaFast = frames.slice(-smaFastP).reduce((a, b) => a + b.avg, 0) / smaFastP
			frame.smaSlow = frames.slice(-smaSlowP).reduce((a, b) => a + b.avg, 0) / smaSlowP

			frame.adx = adx.nextValue(frame);
			if(frame.adx)
			{
				frame.adx = frame.adx.adx / 100;
			}

			const bullData = {
			  open: [],
			  high: [],
			  close: [],
			  low: [],
			}
			const bullPeriod = 10;
			const bullFrames = frames.slice(-bullPeriod);
			bullFrames.forEach(f => {
				bullData.open.push(f.open);
				bullData.high.push(f.high);
				bullData.close.push(f.close);
				bullData.low.push(f.low);
			});
			frame.bullish = BULLISH(bullData) ? 1.1 : 0.9;

			frame.coins = coins;
			frame.money = money;
			frame.totalMoneyValue = coins * frame.avg + money;

			frame.dir = DIR_SAME;

			if(lastFrame)
			{
				const useWeightedAvg = true;

				let curVal = useWeightedAvg ? frame.weightedAvg : frame.avg;
				let prevVal = useWeightedAvg ? lastFrame.weightedAvg : lastFrame.avg;

				const diff = curVal - prevVal;
				const diffPercent = curVal / prevVal;

				frame.diff = diff;
				frame.diffPercent = diffPercent;

				const rollingDiffLength = 5;

				const actualRollingDiffLength = Math.min(frames.length - 1, rollingDiffLength);

				frame.rollingDiff = frames.slice(-actualRollingDiffLength).reduce((a, b) => a + b.diff, 0) / actualRollingDiffLength;
				frame.rollingDiffPercent = frames.slice(-actualRollingDiffLength).reduce((a, b) => a + b.diffPercent, 0) / actualRollingDiffLength;

				if(diff < 0)
				{
					frame.dir = DIR_DOWN;
				}
				else if(diff > 0)
				{
					frame.dir = DIR_UP;
				}
				else
				{
					frame.dir = DIR_SAME;
				}

				if(frame.dir != DIR_SAME && frame.dir != lastFrame.dir)
				{
					const extremum = {
						price: lastFrame.avg,
						time: lastFrame.openTime,
						type: lastFrame.dir == DIR_UP ? 'up' : 'down'
					};

					extremums.push(extremum);
					if(extremum.type == 'down')
					{
						downs.push(extremum);
					}
					else if(extremum.type == 'up')
					{
						ups.push(extremum);
					}
				}

				if(transactions.length < 1)
				{
					buy(frame.openTime, frame.avg);
					lastCap = curVal;
				}

				const lastTransaction = transactions[transactions.length - 1];

				if(lastTransaction.type == 'sell')
				{
					lastCap = Math.min(curVal, lastCap);
				}
				else if(lastTransaction.type == 'buy')
				{
					lastCap = Math.max(curVal, lastCap);
				}

				frame.lastCap = lastCap;

				const transDiff = curVal - lastTransaction.price;
				const magn = Math.max(curVal, lastTransaction.price) / Math.min(curVal, lastTransaction.price);

				const capDiff = curVal - lastCap;
				const capDiffAbs = Math.abs(capDiff);
				const transDiffAbs = Math.abs(transDiff);
				const capDiffRatio = capDiffAbs == 0 ? 1 : Math.min(capDiffAbs, transDiffAbs) / Math.max(capDiffAbs, transDiffAbs);
				const capDiffRatioRel = capDiffAbs == 0 ? 1 : capDiffAbs / transDiffAbs;
				const capRatio = Math.min(lastCap, curVal) / Math.max(lastCap, curVal);
				const capRatioRel = lastCap / curVal;
				const capMagn = Math.min(lastCap, lastTransaction.price) / Math.max(lastCap, lastTransaction.price);
				const capMagnRel = lastCap / lastTransaction.price;

				const lostSignificance = capDiffAbs == 0 || transDiffAbs == 0 ? 1 : transDiffAbs / capDiffAbs;

				frame.capMagnRel = capMagnRel;
				//magnitudeOverTime.push([k.openTime, capRatioRel]);

				let shouldSell;
				let shouldBuy;

				shouldSell = lastTransaction.type == 'buy' && capDiffRatioRel < 1;
				shouldBuy = lastTransaction.type == 'sell' && capDiffRatioRel < 1;

				let significant = transDiffAbs != 0 && transDiffAbs / capDiffAbs > 1 && false;

				frame.capMagnRel = 1 - (Math.abs(capDiffAbs - transDiffAbs) / curVal);
				frame.capMagnRel = 1 - (Math.abs(transDiffAbs) / curVal);

				significant = frame.capMagnRel < 0.985;

				frame.capMagnRel = 1 - (Math.abs(capDiffAbs) / curVal);

				const capMagnThresh = 0.003;

				shouldSell = lastTransaction.type == 'buy' && ((diff < 0 && capMagnRel > (1 + capMagnThresh)) || (diff < 0 && significant));
				shouldBuy = lastTransaction.type == 'sell' && ((diff > 0 && capMagnRel < (1 - capMagnThresh)) || (diff > 0 && significant));

				shouldSell = lastTransaction.type == 'buy' && ((diff < 0 && frame.capMagnRel < 0.99) || (diff < 0 && significant));
				shouldBuy = lastTransaction.type == 'sell' && ((diff > 0 && frame.capMagnRel < 0.99) || (diff > 0 && significant));

				const capTransDiffAbs = Math.abs(lastTransaction.price - lastCap);
				const dropPercentFromlastCap = capTransDiffAbs != 0 ? Math.abs(capDiffAbs) / capTransDiffAbs : 0;

				//shouldSell = lastTransaction.type == 'buy' && ((diff < 0 && frame.capMagnRel < 0.99 && dropPercentFromlastCap > 0.02) || (diff > 0 && significant));
				//shouldBuy = lastTransaction.type == 'sell' && ((diff > 0 && frame.capMagnRel < 0.99 && dropPercentFromlastCap > 0.02) || (diff < 0 && significant));

				frame.capMagnRel = Math.min(1, dropPercentFromlastCap);

				frame.capMagnRel = frame.totalMoneyValue / lastTransaction.value;
				//if(lastTransaction.type == 'buy' && diff < 0 && frame.capMagnRel > 1.005 && 1 - (Math.abs(capDiffAbs) / curVal) < 0.99)
				if(lastTransaction.type == 'buy' && diff < 0 && dropPercentFromlastCap >= 0.25 && frame.capMagnRel > 1.005)
				{
					//shouldSell = true;
				}				

				if(lastTransaction.type == 'sell' && diff > 0 && dropPercentFromlastCap >= 0.25)
				{
					//shouldBuy = true;
				}

				const {smaSlow, smaFast } = frame;
				const {smaSlow: lastSmaSlow, smaFast: lastSmaFast} = lastFrame;

				//const {smaSlow, emaFast: smaFast} = frame;
				//const {smaSlow: lastSmaSlow, emaFast: lastSmaFast} = lastFrame;

				//const {emaSlow: smaSlow, emaFast: smaFast} = frame;
				//const {emaSlow: lastSmaSlow, emaFast: lastSmaFast} = lastFrame;

				const downCross = (lastSmaFast <= lastSmaSlow && smaFast > smaSlow);
				const upCross   = (lastSmaSlow <= lastSmaFast && smaSlow > smaFast);

				if(downCross)
				{
					//frame.annotations.push({text: 'downCross'});
					//console.log({smaSlow, smaFast, lastSmaSlow, lastSmaFast})
				}

				if(upCross)
				{
					//frame.annotations.push({text: 'upCross'});
				}

				const adxIsEnough = frame.adx > 0.2 || true;

				shouldSell = lastTransaction.type == 'buy' && downCross && adxIsEnough;
				shouldBuy = lastTransaction.type == 'sell' && upCross && adxIsEnough;

				const buyFactor = 0.0003;
				const sellFactor = -0.0003;
				const tradeFactor = (smaSlow / lastSmaSlow) - 1;
				shouldBuy = tradeFactor > buyFactor && lastTransaction.type == 'sell';
				shouldSell = tradeFactor < sellFactor && lastTransaction.type == 'buy';

				console.log(tradeFactor)

				frame.capMagnRel = 1 - (Math.abs(capDiffAbs) / curVal);

				//frame.capMagnRel = Math.min(1, dropPercentFromlastCap);
				//frame.capMagnRel = 0;

				if(shouldSell)
				{
					sell(frame.openTime, frame.avg);
				}
				else if(shouldBuy)
				{
					buy(frame.openTime, frame.avg);
				}
			}
		}

		let minVal = Infinity;
		let minValTime = undefined;
		let maxGap = -Infinity;

		let buyTime = undefined;
		let sellTime = undefined;
		let buyVal = undefined;
		let sellVal = undefined;

		for(const f of frames)
		{ 
			if(f.avg < minVal)
			{
				minVal = f.avg;
				minValTime = f.openTime;
			}

			const gap = f.avg - minVal;
			if(gap > maxGap)
			{
				maxGap = gap;
				buyTime = minValTime;
				sellTime = f.openTime;
				buyVal = minVal;
				sellVal = f.avg;
			}
		}

		let value = money;

		if(coins > 0)
		{
			const f = frames[frames.length - 1];
			const val = f.avg;

			value += coins * val;
		}

		console.log((sellVal / buyVal))
		console.log({value, money, coins})

		const exportData = {
			buyTime,
			buyVal, 
			sellTime,
			sellVal,

			transactions,
			sells,
			buys,

			extremums,
			ups,
			downs
		};

		this.exportData = exportData;
	}

	makeChartData()
	{
		if(!this.exportData) return {};

		const {
			buyTime,
			buyVal, 
			sellTime,
			sellVal,

			transactions,
			sells,
			buys,

			extremums,
			ups,
			downs
		} = this.exportData; 

		const frames = this.frames;

		const series = [];
		const annotations = {
			yaxis: [],
			xaxis: [],
			points: []
		};

		true && frames.forEach(f => {
			for(const a of f.annotations || [])
			{
				annotations.points.push({
					x: f.openTime,
					y: a.y || f.avg,
			        strokeDashArray: 0,
			        borderColor: "#775DD0",
			        label: {
			          borderColor: "#775DD0",
			          style: {
			            color: "#fff",
			            background: "#775DD0"
			          },
			          text: a.text
			        }
				});
			}
		});

		true && transactions.forEach(t => {
			annotations.points.push({
				x: t.time,
				y: t.price,
		        strokeDashArray: 0,
		        borderColor: "#775DD0",
		        label: {
		          borderColor: "#775DD0",
		          style: {
		            color: "#fff",
		            background: "#775DD0"
		          },
		          text: t.type + (t.type == 'sell' ? (' ' + t.gainRatio.toFixed(5)) : '')
		        }
			});
		});

		false && extremums.forEach(e => {
			annotations.points.push({
				x: e.time,
				y: e.price,
		        strokeDashArray: 0,
		        borderColor: "#775DD0",
		        label: {
		          borderColor: "#775DD0",
		          style: {
		            color: "#fff",
		            background: "#775DD0"
		          },
		          text: e.type
		        }
			});
		});

		false && annotations.points.push({
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
	          text: "absolute buy"
	        }
		});

		false && annotations.points.push({
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
	          text: "absolute Sell " + (sellVal / buyVal).toFixed
	        }
		});

		false && series.push({
			name: 'sales',
			type: 'candlestick',
			data: frames.map(f => [
					f.openTime,
					f.open,
					f.high,
					f.low,
					f.close
				])
		});

		const addSerie = (name, dataName, opposite = false) => {
			series.push({
				name, 
				type: 'line',
				data: frames.filter(f => f[dataName] !== undefined).map(f => [f.openTime, f[dataName]]),
				side: opposite ? 'opposite' : undefined
			});
		};

		true && addSerie('value', 'avg');
		false && addSerie('rolling average', 'rollingAvg');
		true && addSerie('weighted average', 'weightedAvg');
		true && addSerie('last cap', 'lastCap');
		false && addSerie('diff over time', 'diffOverTime');
		false && addSerie('diff rolling avg', 'diffRollingOverTime');
		true && addSerie('magn', 'capMagnRel', true);
		true && addSerie('money', 'totalMoneyValue', true);
		true && addSerie('diff percent', 'diffPercent', true);
		true && addSerie('rolling diff percent', 'rollingDiffPercent', true);
		true && addSerie('emaFast', 'emaFast');
		true && addSerie('emaSlow', 'emaSlow');
		true && addSerie('smaFast', 'smaFast');
		true && addSerie('smaSlow', 'smaSlow');
		true && addSerie('adx', 'adx', true);
		true && addSerie('bullish', 'bullish', true);

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

		const offset = 0.05;

		maxLeft += spanLeft * offset;
		minLeft -= spanLeft * offset;

		maxRight += spanRight * offset;
		minRight -= spanRight * offset;

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

		return {
			series,
			annotations,
			yaxis
		}
	}
}