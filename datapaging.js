define(["qlik"
],
	function (qlik) {

		return {
			support: {
				snapshot: true,
				export: true,
				exportData: false
			},
			initialProperties: {
				qHyperCubeDef: {
					qDimensions: [],
					qMeasures: [],
					qInitialDataFetch: [{
						qWidth: 10,
						qHeight: 1000
					}]
				}
			},
			definition: {
				type: "items",
				component: "accordion",
				items: {
					dimensions: {
						uses: "dimensions",
						min: 1,
					},
					measures: {
						uses: "measures",
						min: 0,
					}
				}
			},
			paint: function ($element, layout) {
				try {

					console.log("Paint");
					//console.log({ layout });
					//console.log("Hypercube", layout.qHyperCube);
					const that = this;
					const app = qlik.currApp();

					const hyperCubeSize = 10000;
					const totalRowCount = that.backendApi.getRowCount();

					if (countTempRows() < totalRowCount) {
						console.log("Get next Datapage");
						const requestPage = [{
							qTop: 1000,
							qLeft: 0,
							qWidth: 10,
							qHeight: 1000
						}];
						that.backendApi.getData(requestPage).then((dataPages) => {
							console.log("Datapages", dataPages);
							that.paint($element, layout);
							updateHTML();
						})
					}
					//add your rendering code here
					updateHTML();
					//needed for export
					//return qlik.Promise.resolve();
					function countTempRows() {
						let rowCount = 0;
						layout.qHyperCube.qDataPages.forEach(qDataPage => {
							rowCount += qDataPage.qMatrix.length;
						});
						return rowCount;
					}
					function updateHTML() {
						console.log("UpdateHTML", countTempRows());
						$element.html("Rowcount: " + countTempRows() + "/" + totalRowCount);
					}
				} catch (e) { console.error(e) }
			}
		};

	});

