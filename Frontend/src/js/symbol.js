import {klineIntervals} from './consts';

export default class Symbol
{
	name = "";
	fees = {
		taker: 0,
		maker: 0,
	}

	klines = {};

	constructor(config)
	{
		this.name = config.symbol;
		this.base = config.baseAsset;
		this.quote = config.quoteAsset;
		this.status = config.status;

		this.klines = {};
		klineIntervals.forEach((i) => this.klines[i] = []);
	}

	getKlines(interval)
	{
		return this.klines[interval];
	}
	
	setFees(feeData)
	{
		this.fees.taker = feeData.taker;
		this.fees.maker = feeData.maker;
	}
	
	appenKlines(interval, data)
	{
		let klines = this.klines[interval];

		const inData = data.map(d => {
			d = d.map(d => parseFloat(d));
			return {
				openTime: d[0],
				open: d[1],
				high: d[2],
				low: d[3],
				close: d[4],
				volume: d[5],
				closeTime: d[6],
				quoteVolume: d[7],
				tradeCount: d[8],
				avg: (d[1] + d[4]) / 2,
				midTime: (d[0] + d[6]) / 2
			}
		});

		if(klines.length == 0)
		{
			this.klines[interval] = inData;
			return;
		}

		const start = klines[0].midTime;
		const end = klines[klines.length - 1].midTime;

		const dataStart = inData[0].midTime;
		const dataEnd = inData[inData.length - 1].midTime;

		if(dataStart > end)
		{
			klines = [...klines, ...inData];
		}
		else if(dataEnd < start)
		{
			klines = [...inData, ...klines];
		}
		else
		{
			let overlapStart = klines.findIndex(k => {
				return k.midTime >= dataStart;
			});
			let overlapEnd = [...klines].reverse().findIndex(k => {
				return k.midTime <= dataEnd;
			});

			if(overlapStart < 0)
			{
				overlapStart = 0;
			}

			const overlapLength = overlapEnd < 0 ? 0 : (klines.length - overlapEnd) - overlapStart;

			klines.splice(overlapStart, overlapLength, ...inData);
		}

		this.klines[interval] = klines;
	}
}

/*
setTimeout(() => 
{
	let s = new Symbol({})
	s.appenKlines('1m', [
	  [1, 1, 1, 1, 1, 1, 1],
	])
	//console.log(s);
	s.appenKlines('1m', [
	  [5, 1, 1, 1, 1, 1, 5],
	])
	//console.log(s);
	s.appenKlines('1m', [
	  [4, 1, 1, 1, 1, 1, 4],
	])

	s.appenKlines('1m', [
	  [3, 1, 1, 1, 1, 1, 3],
	])

	s.appenKlines('1m', [
	  [4, 2, 2, 2, 2, 2, 4],
	  [6, 2, 2, 2, 2, 2, 6],
	])

	s.appenKlines('1m', [
	  [0, 2, 2, 2, 2, 2, 0],
	  [4, 2, 2, 2, 2, 2, 4],
	])
}, 1000);
*/