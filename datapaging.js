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

					console.log({ layout });
					//console.log("Hypercube", layout.qHyperCube);
					const that = this;
					const app = qlik.currApp();

					const hyperCubeSize = 10000;
					const totalRowCount = that.backendApi.getRowCount();

					if (countTempRows() < totalRowCount) {
						console.log("Get next Datapage");
						const requestPage = calculateRequestPage(layout);
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
					function calculateRequestPage(layout) {
						const rowsLoaded = countTempRows();
						const qSize = layout.qHyperCube.qSize;
						const qWidth = qSize.qcx;
						const qHeight = Math.min(Math.floor(10000 / qWidth), qSize.qcy - rowsLoaded);
						const qTop = rowsLoaded;
						const requestPage = [{
							qTop,
							qLeft: 0,
							qWidth,
							qHeight,
						}];
						console.log("Load " + qHeight + " more data rows.");
						console.log("Requestpage", requestPage);
						return requestPage;
					}
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

