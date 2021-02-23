import {klineIntervals} from './consts';

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

		if(!symbol || !rollingAverageLength || !interval) return;

		console.log({symbol, interval, rollingAverageLength})
		const klines = symbol.getKlines(interval);
		console.log({klines})
		if(!klines) return;

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

		const buys = [];
		const sells = [];

		const ups = [];
		const downs = [];

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

				const significant = transDiffAbs != 0 && transDiffAbs / lastCap > 0.05;

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

					sells.push([k.openTime, val]);
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

					buys.push([k.openTime, val]);
				}

				if(diff > 0)
				{
					//ups.push([k.openTime, val]);
				}
				else if(diff < 0)
				{
					//downs.push([k.openTime, val]);
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

		const exportData = {
			buyTime,
			buyVal, 
			sellTime,
			sellVal,

			valueOverTime,
			moneyOverTime,
			magnitudeOverTime,
			diffRollingOverTime,
			diffOverTime,
			capOverTime,
			weightedAvg,
			rollingAvg,

			sells,
			buys,
			ups,
			downs
		};

		this.exportData = exportData;
	}

	makeChartData()
	{
		const {
			buyTime,
			buyVal, 
			sellTime,
			sellVal,

			valueOverTime,
			moneyOverTime,
			magnitudeOverTime,
			diffRollingOverTime,
			diffOverTime,
			capOverTime,
			weightedAvg,
			rollingAvg,

			sells,
			buys,
			ups,
			downs
		} = this.exportData; 

		const series = [];
		const annotations = {
			yaxis: [],
			xaxis: [],
			points: []
		};

		sells.forEach(d => {
			annotations.points.push({
				x: d[0],
				y: d[1],
		        strokeDashArray: 0,
		        borderColor: "#775DD0",
		        label: {
		          borderColor: "#775DD0",
		          style: {
		            color: "#fff",
		            background: "#775DD0"
		          },
		          text: "sell"
		        }
			});
		})

		buys.forEach(d => {
			annotations.points.push({
				x: d[0],
				y: d[1],
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
		})

		ups.forEach(d => {
			annotations.points.push({
				x: d[0],
				y: d[1],
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
		})

		downs.forEach(d => {
			annotations.points.push({
				x: d[0],
				y: d[1],
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
		})

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
	          text: "absolute buy"
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
	          text: "absolute Sell " + (sellVal / buyVal)
	        }
		});

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

		return {
			series,
			annotations,
			yaxis
		}
	}
}