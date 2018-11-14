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

					const datapagingType = layout.props.datapagingType;
					const totalRowCount = that.backendApi.getRowCount();

					// Determine which data loading strategie has to run
					if (datapagingType === "backendApiGetData") {
						const qSize = layout.qHyperCube.qSize;
						const getData = new backendApiGetData(that, layout, $element);
						getData.getDataByBackendApi(totalRowCount, qSize);
					} else if (datapagingType === "appCreateCube") {
						layout.props.timeStart = Date.now();
						layout.props.timeEnd = Date.now();
						const app = qlik.currApp();
						const numberOfLinesPerCube = Math.floor(10000 / layout.qHyperCube.qSize.qcx);
						const numberOfCubesToFetch = Math.ceil(totalRowCount / numberOfLinesPerCube);
						that.backendApi.getProperties().then(props => {
							const createCube = new appCreateCube(app, props.qHyperCubeDef, layout, $element, totalRowCount);
							createCube.getDataByAppCreateCube(numberOfCubesToFetch, 0, 0);
						});
					}

				} catch (e) { console.error(e) }
			}
		};

	});

/**
 * Class for retrieving data from click by using app.createCube()
 * @see https://help.qlik.com/en-US/sense-developer/November2018/Subsystems/APIs/Content/Sense_ClientAPIs/CapabilityAPIs/AppAPI/createCube-method.htm
 */
class appCreateCube {

	constructor(app, hyperCubeDef, layout, $element, totalRowCount) {
		console.log("Constructor");
		this.app = app;
		this.layout = layout;
		this.$element = $element;
		this.hyperCubeDef = hyperCubeDef;
		this.totalRowCount = totalRowCount;
		this.html = new htmlUpdater(this.layout, this.$element, "appCreateCube");
	}

	/**
	 * Creates a new hypercube and then gets a specific hypercube-slice of it which is calculated in dataFetch object.
	 * @param {} numberOfCubesToFetch Number of cubes that must be fetched to receive all data for the current selection.
	 * @param {} numberOfFetchedCubes Numer of all fetched cubes.
	 * @param {} qTop The index of the last loaded row from a previous hypercube call.
	 */
	getDataByAppCreateCube(numberOfCubesToFetch, numberOfFetchedCubes, qTop) {
		if (numberOfFetchedCubes < numberOfCubesToFetch) {
			const qSize = this.layout.qHyperCube.qSize; // Total size (rows*columns) of the hypercube
			const qWidth = qSize.qcx; // Number of columns: # of dimensions + # of measures
			const qHeight = Math.min(Math.floor(10000 / qWidth), qSize.qcy - qTop);
			const dataFetch = [{
				qTop,
				qLeft: 0,
				qWidth,
				qHeight,
			}];
			this.hyperCubeDef.qInitialDataFetch = dataFetch; // Override qInitialDataFetch here
			return new Promise((resolve, reject) => {
				this.app.createCube(this.hyperCubeDef, hyperCubeReply => {
					resolve(hyperCubeReply);
				});
			}).then((reply) => {
				numberOfFetchedCubes++;
				console.log("Fetching cube #: " + numberOfFetchedCubes);
				this.layout.props.timeEnd = Date.now();
				const qArea = reply.qHyperCube.qDataPages[0].qArea;
				this.html.updateHTML(qArea.qTop + qArea.qHeight, this.totalRowCount, qSize);
				this.getDataByAppCreateCube(numberOfCubesToFetch, numberOfFetchedCubes, qTop + qHeight);
			});

		} else {
			console.log("DONE");
			return;
		}
	}
}

/**
 * Class for retrieving data from click by using backendApi.getData()
 * @see https://help.qlik.com/en-US/sense-developer/November2018/Subsystems/APIs/Content/Sense_ClientAPIs/BackendAPI/getdata-method.htm
 */
class backendApiGetData {

	constructor(that, layout, $element) {
		this.that = that;
		this.layout = layout;
		this.$element = $element;
		this.html = new htmlUpdater(this.layout, this.$element, "backendApiGetData");
	}

	/**
	 * Recalculates the requestpage for the next hypercube-slice from backendApi.getData().
	 * @param {*} layout Qlik Sense extension layout.
	 */
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

	/**
	 * Counts the temporary loaded number of rows by summing up the number of all qDataPages-rows.
	 */
	countTempRows() {
		let rowCount = 0;
		this.layout.qHyperCube.qDataPages.forEach(qDataPage => {
			rowCount += qDataPage.qMatrix.length;
		});
		return rowCount;
	}

	/**
	 * Gets a specific hypercube-slice from backendApi.
	 * Additionally updates the HTML with performance data like taken time and current number of data rows that has been fetched.
	 * @param {} totalRowCount The total number of rows for the current seleciton.
	 * @param {} qSize The total number of columns and rows for the current selection.
	 */
	getDataByBackendApi(totalRowCount, qSize) {
		if (this.layout.qHyperCube.qDataPages.length === 1) {
			this.layout.props.timeStart = Date.now();
			this.layout.props.timeEnd = Date.now();
			this.html.updateHTML(this.countTempRows(), totalRowCount, qSize);
		}
		if (this.countTempRows() < totalRowCount) {
			const requestPage = this.calculateRequestPage(this.layout);
			this.that.backendApi.getData(requestPage).then((dataPages) => {
				this.layout.props.timeEnd = Date.now();
				this.that.paint(this.$element, this.layout);
				this.html.updateHTML(this.countTempRows(), totalRowCount, qSize);
			})
		} else {
			console.log("Finished loading data: ", this.layout);
			return;
		}
	}
}

/**
 * Class that supports a HTML-updater for backendApi.getData- and app.createCube-strategies.
 */
class htmlUpdater {

	constructor(layout, $element, datapagingType) {
		this.layout = layout;
		this.$element = $element;
		this.datapagingType = datapagingType;
	}

	/**
	 * Updates the HTML of the extension after each hypcercube call.
	 * @param {} tempRowCount The currently loaded number of rows.
	 * @param {} totalRowCount The total number of rows for the current selection.
	 * @param {} qSize The total number of columns and rows for the current selection.
	 */
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