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

					if (datapagingType === "backendApiGetData") {
						const qSize = layout.qHyperCube.qSize;
						const b = new backendApiGetData(that, layout, $element);
						b.getDataByBackendApi(totalRowCount, qSize);
					} else if (datapagingType === "appCreateCube") {
						layout.props.timeStart = Date.now();
						layout.props.timeEnd = Date.now();
						const app = qlik.currApp();
						const numberOfLinesPerCube = Math.floor(10000 / layout.qHyperCube.qSize.qcx);
						const numberOfCubesToFetch = Math.ceil(totalRowCount / numberOfLinesPerCube);
						that.backendApi.getProperties().then(props => {
							getDataByAppCreateCube(app, props.qHyperCubeDef, layout, totalRowCount, numberOfCubesToFetch, 0, 0);
						});
					}




					function getDataByAppCreateCube(app, hyperCubeDef, layout, totalRowCount, numberOfCubesToFetch, numberOfFetchedCubes, qTop) {
						console.log("Cubes fetched: " + numberOfFetchedCubes);
						if (numberOfFetchedCubes < numberOfCubesToFetch) {
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
								app.createCube(hyperCubeDef, hyperCubeReply => {
									resolve(hyperCubeReply);
								});
							}).then((reply) => {
								numberOfFetchedCubes++;
								console.log("Fetching cube #: " + numberOfFetchedCubes);
								layout.props.timeEnd = Date.now();
								const qArea = reply.qHyperCube.qDataPages[0].qArea;
								updateHTML(qArea.qTop + qArea.qHeight, qSize);
								getDataByAppCreateCube(app, hyperCubeDef, layout, totalRowCount, numberOfCubesToFetch, numberOfFetchedCubes, qTop + qHeight);
							});

						} else {
							console.log("DONE");
							return;
						}
					}

				} catch (e) { console.error(e) }
			}
		};

	});

class backendApiGetData {

	constructor(that, layout, $element) {
		this.that = that;
		this.layout = layout;
		this.$element = $element;
	}

	calculateRequestPage(layout) {
		const rowsLoaded = this.countTempRows();
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

	countTempRows() {
		let rowCount = 0;
		this.layout.qHyperCube.qDataPages.forEach(qDataPage => {
			rowCount += qDataPage.qMatrix.length;
		});
		return rowCount;
	}


	getDataByBackendApi(totalRowCount, qSize) {
		const html = new htmlUpdater(this.layout, this.$element, "backendApiGetData");
		if (this.layout.qHyperCube.qDataPages.length === 1) {
			this.layout.props.timeStart = Date.now();
			this.layout.props.timeEnd = Date.now();
			html.updateHTML(this.countTempRows(), totalRowCount, qSize);
		}
		if (this.countTempRows() < totalRowCount) {
			const requestPage = this.calculateRequestPage(this.layout);
			this.that.backendApi.getData(requestPage).then((dataPages) => {
				this.layout.props.timeEnd = Date.now();
				this.that.paint(this.$element, this.layout);
				html.updateHTML(this.countTempRows(), totalRowCount, qSize);
			})
		} else {
			console.log("Finished loading data: ", this.layout);
			return;
		}
	}
}

class htmlUpdater {

	constructor(layout, $element, datapagingType) {
		this.layout = layout;
		this.$element = $element;
		this.datapagingType = datapagingType;
	}

	updateHTML(tempRowCount, totalRowCount, qSize) {
		let loadingStrategy = "";
		const numberOfRowsPerCube = Math.floor(10000 / qSize.qcx);
		switch (this.datapagingType) {
			case "backendApiGetData":
				loadingStrategy = "<a href='https://bit.ly/2EZ3nVS' target='_blank'>backendApi.getData()</a>";
				break;
			case "appCreateCube":
				loadingStrategy = "<a href='https://bit.ly/2P6ks4B' target='_blank'>app.createCube()</a>";
				break;
		}
		let html = "";
		html += "Loading strategy: " + loadingStrategy + " . </br>";
		html += "Row count: " + tempRowCount + "/" + totalRowCount + " loaded. </br>";
		html += "Number of columns: " + qSize.qcx + " => rows per fetch: " + numberOfRowsPerCube + ".</br>";
		html += "Number of cubes to be fetched";
		if (this.datapagingType === "appCreateCube") {
			html += " and created";
		} else {
			html += " by just 1 created cube";
		}
		html += ": " + Math.ceil(totalRowCount / numberOfRowsPerCube) + ". </br>";
		html += "Took " + (Math.max(0, this.layout.props.timeEnd - this.layout.props.timeStart)) + " ms.";
		this.$element.html(html);
		this.$element.css({
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
}