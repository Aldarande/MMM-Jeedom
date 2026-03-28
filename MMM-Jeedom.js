'use strict';

Module.register("MMM-Jeedom", {
	// Default module config.
	defaults: {
		updateInterval: 30000, //30s
		initialLoadDelay: 0,
		animationSpeed: 1000,
		displayLastUpdate: false,
		displayLastUpdateFormat: 'dd - HH:mm:ss',
		result: {},
		sensors: [
			{
				idx: "1",
				symbolon: "fa fa-user",
				symboloff: "fa fa-user-o",
				hiddenon: false,
				hiddenoff: false,
				hideempty: false,
				customTitle: "No sensor define in config",
				customTitleOn: undefined,
				customTitleOff: undefined,
				statuson: undefined,
				statusoff: undefined,
				sameLine1: false,
				sameLine2: false,
			},
		],

		Virtual_API: "", // Code API de vos virtual
		TempID: "", // ID pour la température
		HumID: "", // ID pour l'humidité
		jeedomAPIPath: "/core/api/jeeApi.php", //URL Path for get info
		jeedomAPIPathUPDT: "/core/api/jeeApi.php?plugin=virtual&type=event&", //url Path for update
		jeedomHTTPS: true
	},

	start: function () {
		Log.log('LOG' + this.name + ' is started!');
		// Set locale.
		moment.locale(config.language);
		this.title = "Loading...";
		this.loaded = false;
		var self = this;
		this.debug = true;
		this.ModuleJeedomHidden = false; // par défaut on affiche le module (si pas de module carousel ou autre pour le cacher)
		this.userPresence = true; // FIX #7 : variable d'instance au lieu de globale
		this.IntervalID = 0; // à déclarer pour chaque instance pour pouvoir couper la mise à jour pour chacune
		this.lastUpdate = 0;

		this.IntervalID = setInterval(function () { self.updateJeedom(); }, this.config.updateInterval);

		this.sensors = [];
		for (var c in this.config.sensors) {
			var sensor = this.config.sensors[c];
			var newSensor = {
				idx: sensor.idx,
				symbol: sensor.symbol,
				symbolon: sensor.symbolon,
				symboloff: sensor.symboloff,
				hideempty: sensor.hideempty,
				hiddenon: sensor.hiddenon,
				hiddenoff: sensor.hiddenoff,
				sameLine1: sensor.sameLine1,
				sameLine2: sensor.sameLine2,
				customTitle: sensor.customTitle,
				customTitleOn: sensor.customTitleOn,
				customTitleOff: sensor.customTitleOff,
				status: "",
				statuson: sensor.statuson,
				statusoff: sensor.statusoff,
				sname: "",
				boolean: sensor.boolean,
				unit: sensor.unit
			};
			this.sensors.push(newSensor);
		}

		// first update on start
		self.updateJeedom();
	},

	suspend: function () { //fct core appelée quand le module est caché
		this.ModuleJeedomHidden = true;
		this.debugger("Fct suspend - ModuleHidden = " + this.ModuleJeedomHidden);
		this.GestionUpdateInterval();
	},

	resume: function () { //fct core appelée quand le module est affiché
		this.ModuleJeedomHidden = false;
		this.debugger("Fct resume - ModuleHidden = " + this.ModuleJeedomHidden);
		this.GestionUpdateInterval();
	},

	debugger: function (message) {
		if (this.debug === true) {
			Log.log("[Jeedom] " + message);
		}
	},

	// FIX #1 : une seule fonction notificationReceived fusionnant USER_PRESENCE, INDOOR_TEMPERATURE et INDOOR_HUMIDITY
	notificationReceived: function (notification, payload, sender) {
		this.debugger("Fct notif notif !!! " + notification);

		if (notification === "USER_PRESENCE") {
			this.debugger("Fct notificationReceived USER_PRESENCE - payload = " + payload);
			this.userPresence = payload; // FIX #7 : variable d'instance
			this.GestionUpdateInterval();
		}

		if (notification === "INDOOR_TEMPERATURE") {
			if (this.config.Virtual_API != '') {
				this.debugger(`API : ${this.config.Virtual_API} `);
				if (this.config.TempID != '') {
					this.indoorTemperature = this.roundValue(payload);
					this.debugger(`la temperature remontée est ${this.indoorTemperature}`);
					this.debugger(`l'adresse de jeedom est ${this.config.jeedomURL}`);
					this.updatejeedom(this.config.TempID, this.indoorTemperature);
					this.debugger(`${this.name} renvoie la temp ${this.indoorTemperature}`);
				}
			}
		}

		if (notification === "INDOOR_HUMIDITY") {
			if (this.config.Virtual_API != '') {
				if (this.config.HumID != '') { // FIX #2 : "HumdID" → "HumID"
					this.debugger(` HumID: ${this.config.HumID}`);
					this.indoorHumidity = this.roundValue(payload);
					this.updatejeedom(this.config.HumID, this.indoorHumidity);
					this.debugger(`${this.name} renvoie l humidite :  ${this.indoorHumidity}`);
				}
			}
		}
	},

	GestionUpdateInterval: function () {
		this.debugger("Call GestionUpdateInterval : " + this.userPresence + " / " + this.ModuleJeedomHidden);
		if (this.userPresence === true && this.ModuleJeedomHidden === false) {
			var self = this;
			this.debugger(this.name + " est revenu et user present ! On update");

			self.updateJeedom();
			if (this.IntervalID === 0) {
				this.IntervalID = setInterval(function () { self.updateJeedom(); }, this.config.updateInterval);
			}
		} else {
			this.debugger("Personne regarde : on stop l'update ! ID : " + this.IntervalID);
			clearInterval(this.IntervalID);
			this.IntervalID = 0;
		}
	},

	getStyles: function () {
		return ['font-awesome.css'];
	},

	// Override dom generator.
	getDom: function () {

		var sameLineValueMemorisation = '';
		var sameLineUnitMemorisation = '';

		var wrapper = document.createElement("div");
		var data = this.result;
		if (!this.loaded) {
			wrapper.innerHTML = "Loading...";
			wrapper.className = "dimmed light small";
			return wrapper;
		}
		var tableWrap = document.createElement("table");
		tableWrap.className = "small";

		for (var c in this.sensors) {
			var sensor = this.sensors[c];

			if (sensor.boolean && sensor.status > 1) sensor.status = 1;

			if ((sensor.status == 0 && sensor.hideempty)) continue;
			if ((sensor.status == "On" && sensor.hiddenon) || (sensor.status == "Off" && sensor.hiddenoff)) continue;

			if (sensor.sameLine1) {
				sameLineValueMemorisation = sensor.status;
				if (typeof sensor.unit !== 'undefined') {
					sameLineUnitMemorisation = sensor.unit;
				}
				continue;
			}

			var sensorWrapper = document.createElement("tr");
			sensorWrapper.className = "normal";

			var symbolTD = document.createElement('td');
			symbolTD.className = "symbol align-left";
			var symbol = document.createElement('i');
			var symbolClass = sensor.symboloff;
			if (sensor.boolean && sensor.status == 1) symbolClass = sensor.symbolon;
			if (typeof sensor.boolean == 'undefined') symbolClass = sensor.symbol;
			symbol.className = symbolClass;
			symbolTD.appendChild(symbol);
			sensorWrapper.appendChild(symbolTD);

			var titleTD = document.createElement('td');
			titleTD.className = "title bright align-left";
			titleTD.innerHTML = sensor.sname;
			if (typeof sensor.customTitle !== 'undefined') titleTD.innerHTML = sensor.customTitle;
			if (sensor.boolean) {
				if (sensor.status == 1 && typeof sensor.customTitleOn !== 'undefined') titleTD.innerHTML = sensor.customTitleOn;
				if (sensor.status == 0 && typeof sensor.customTitleOff !== 'undefined') titleTD.innerHTML = sensor.customTitleOff;
			}
			sensorWrapper.appendChild(titleTD);

			var statusTD = document.createElement('td');
			statusTD.className = "time light align-right";
			if (sensor.sameLine2) {
				statusTD.innerHTML = statusTD.innerHTML + sameLineValueMemorisation + " "
					+ sameLineUnitMemorisation + " - ";
			}

			if (!sensor.boolean) {
				statusTD.innerHTML = statusTD.innerHTML + sensor.status;
				if (typeof sensor.unit !== 'undefined') {
					statusTD.innerHTML = statusTD.innerHTML + " " + sensor.unit;
				}
				sensorWrapper.appendChild(statusTD);

			} else if (sensor.status == 1 && typeof sensor.statuson !== 'undefined') {
				statusTD.innerHTML = statusTD.innerHTML + sensor.statuson;
				sensorWrapper.appendChild(statusTD);

			} else if (sensor.status == 0 && typeof sensor.statusoff !== 'undefined') {
				statusTD.innerHTML = statusTD.innerHTML + sensor.statusoff;
				sensorWrapper.appendChild(statusTD);
			}

			tableWrap.appendChild(sensorWrapper);
		}
		wrapper.appendChild(tableWrap);

		if (this.config.displayLastUpdate) {
			var updateinfo = document.createElement("div");
			updateinfo.className = "xsmall light align-left";
			updateinfo.innerHTML = "Update : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat);
			wrapper.appendChild(updateinfo);
		}

		return wrapper;

	},

	updateJeedom: function () {
		this.sendSocketNotification('RELOAD', this.config);
		this.debugger("Jeedom RELOAD " + Date.now() / 1000);
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "RELOAD_DONE") {
			this.result = payload;

			for (var c in this.sensors) {
				var sensor = this.sensors[c];
				if (payload.result[sensor.idx] != null) {
					sensor.status = payload.result[sensor.idx].value;
				}
			}
			this.loaded = true;
			// FIX #8 : lastUpdate mis à jour à la réception de la réponse
			if (this.config.displayLastUpdate) {
				this.lastUpdate = Date.now() / 1000;
				this.debugger("Update Jeedom reçue pour " + this.config.sensors[0].idx + " - à : " + moment.unix(this.lastUpdate).format('dd - HH:mm:ss'));
			}
			this.updateDom(this.config.animationSpeed); // FIX #4 : this.config.animationSpeed
		}
	},

	roundValue: function (temperature) {
		const decimals = this.config.roundTemp ? 0 : 1;
		const roundValue = parseFloat(temperature).toFixed(decimals);
		return roundValue === "-0" ? 0 : roundValue;
	},

	updatejeedom: function (ID, Values) {
		// FIX #3 : vérification sur le paramètre ID (et non this.ID)
		if (!ID || ID === '') {
			console.log('Pas d ID de valeur Jeedom');
			return;
		}
		var jeedomprot = this.config.jeedomHTTPS ? "https" : "http";
		var url = jeedomprot + "://" + this.config.jeedomURL + this.config.jeedomAPIPathUPDT + "&apikey=" + this.config.Virtual_API + "&id=" + ID + "&value=" + Values;
		this.debugger(`ToJeedom >> ${url}`);

		// FIX #6 : requête asynchrone (ne bloque plus le thread UI)
		var self = this;
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.open("GET", url, true);
		xmlHttp.onreadystatechange = function () {
			if (xmlHttp.readyState === 4) {
				self.debugger(`ToJeedom >> Status : ${xmlHttp.status}-${xmlHttp.statusText} Reponse : ${xmlHttp.responseText}`);
			}
		};
		xmlHttp.send(null);
	},
});
