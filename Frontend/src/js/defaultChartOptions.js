const defaultChartOptions = {
	chart: {
		id: 'mainChart',
		type: 'line',
		zoom: {
			autoScaleYaxis: false
		},
        stroke: {
          width: 0
        },
		animations: {
			enabled: false,
			easing: 'easeinout',
			speed: 50,
			animateGradually: {
				enabled: true,
				delay: 1,
				speed: 1,
			},
			dynamicAnimation: {
				enabled: true,
				speed: 50
			}
		}
	},
    tooltip: {
      fixed: {
        enabled: true,
        position: 'topLeft', // topRight, topLeft, bottomRight, bottomLeft
        offsetY: 30,
        offsetX: 60
      },
    },
	series: [],
	xaxis: {
		type: 'datetime'
	}
};

export default defaultChartOptions;