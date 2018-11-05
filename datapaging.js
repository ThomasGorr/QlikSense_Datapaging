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
					},
					dataPaging: {
						type: "string",
						component: "dropdown",
						label: "Data paging type",
						ref: "props.datapagingType",
						options: [{
							value: "backendApiGetData",
							label: "backendApi.getData()",
						}, {
							value: "appCreateCube",
							label: "app.createCube()",
						}]
					},
				}
			},
			paint: function ($element, layout) {
				try {
					const that = this;
					const extensionId = layout.qInfo.qId;

					const datapagingType = layout.props.datapagingType;
					const totalRowCount = that.backendApi.getRowCount();

					console.log("NEW PAINT", datapagingType, totalRowCount);
					if (datapagingType === "backendApiGetData") {
						getDataByBackendApi(totalRowCount);
					} else if (datapagingType === "appCreateCube") {
						const app = qlik.currApp();
						const numberOfLinesPerCube = Math.floor(10000 / layout.qHyperCube.qSize.qcx);
						const numberOfCubesToFetch = Math.ceil(totalRowCount / numberOfLinesPerCube);
						console.log("############ " + numberOfCubesToFetch + " #################" + Date.now());
						that.backendApi.getProperties().then(props => {
							console.log("Props", props);
							getDataByAppCreateCube(app, props.qHyperCubeDef, layout, totalRowCount, numberOfCubesToFetch, 0, 0);
						});
					}


					function calculateRequestPage(layout) {
						const rowsLoaded = countTempRows();
						const qSize = layout.qHyperCube.qSize; // Total size (rows*columns) of the hypercube
						const qWidth = qSize.qcx; // Number of columns: # of dimensions + # of measures
						const qHeight = Math.min(Math.floor(10000 / qWidth), qSize.qcy - rowsLoaded);
						const qTop = rowsLoaded; // Last loaded rows
						const requestPage = [{
							qTop,
							qLeft: 0,
							qWidth,
							qHeight,
						}];
						return requestPage;
					}

					function getDataByBackendApi(totalRowCount) {
						if (layout.qHyperCube.qDataPages.length === 1) {
							layout.props.timeStart = Date.now();
							layout.props.timeEnd = Date.now();
							updateHTML(countTempRows());
						}
						if (countTempRows() < totalRowCount) {
							const requestPage = calculateRequestPage(layout);
							that.backendApi.getData(requestPage).then((dataPages) => {
								layout.props.timeEnd = Date.now();
								that.paint($element, layout);
								updateHTML(countTempRows());
							})
						} else {
							console.log("Finished loading data: ", layout);
						}
					}

					function getDataByAppCreateCube(app, hyperCubeDef, layout, totalRowCount, numberOfCubesToFetch, numberOfFetchedCubes, qTop) {
						if (qTop === 0) {
							layout.props.timeStart = Date.now();
							layout.props.timeEnd = Date.now();
						}
						if (numberOfFetchedCubes < numberOfCubesToFetch) {
							console.log("Cubes fetched: " + numberOfFetchedCubes);
							const qSize = layout.qHyperCube.qSize; // Total size (rows*columns) of the hypercube
							const qWidth = qSize.qcx; // Number of columns: # of dimensions + # of measures
							const qHeight = Math.min(Math.floor(10000 / qWidth), qSize.qcy - qTop);
							const dataFetch = [{
								qTop,
								qLeft: 0,
								qWidth,
								qHeight,
							}];
							hyperCubeDef.qInitialDataFetch = dataFetch; // Override qInitialDataFetch here
							return new Promise((resolve, reject) => {
								app.createCube(hyperCubeDef, replyy => {
									resolve(replyy);
								});
							}).then((reply) => {
								console.log("THEEEN", reply);
								numberOfFetchedCubes++;
								console.log("Fetching cube #: " + numberOfFetchedCubes);
								layout.props.timeEnd = Date.now();
								updateHTML(reply.qHyperCube.qDataPages[0].qArea.qTop + reply.qHyperCube.qDataPages[0].qArea.qHeight);
								getDataByAppCreateCube(app, hyperCubeDef, layout, totalRowCount, numberOfCubesToFetch, numberOfFetchedCubes, qTop + qHeight);
							});

						} else {
							console.log("DONE");
							return;
						}
					}

					function countTempRows() {
						let rowCount = 0;
						layout.qHyperCube.qDataPages.forEach(qDataPage => {
							rowCount += qDataPage.qMatrix.length;
						});
						return rowCount;
					}

					function updateHTML(tempRowCount) {
						let loadingStrategy = "";
						switch (datapagingType) {
							case "backendApiGetData":
								loadingStrategy = "<a href='https://bit.ly/2EZ3nVS' target='_blank'>backendApi.getData()</a>";
								break;
							case "appCreateCube":
								loadingStrategy = "<a href='https://bit.ly/2P6ks4B' target='_blank'>app.createCube()</a>";
								break;
						}
						let html = "";
						html += "Loading strategy: " + loadingStrategy + " . </br>";
						html += "Rowcount: " + tempRowCount + "/" + totalRowCount + " loaded. </br>";
						html += "Took " + (Math.max(0, layout.props.timeEnd - layout.props.timeStart)) + " ms.";
						$element.html(html);
						$element.css({
							position: "relative",
							background: "white",
							color: "#888",
							display: "inline-block",
							"border-radius": "5px",
							padding: "8px",
							"font-size": "32px",
							"font-family": "Arial",
							"z-index": 1000,
						});
					}
				} catch (e) { console.error(e) }
			}
		};

	});

