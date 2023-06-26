// Load object models, current TLdict and chat suggestions
setImmediate(() => {
	RequestModel(1234380931);
	RequestModel(1687915882);
	RequestModel(2001253060);
	RequestModel(-939994077);
	RequestModel(-623969841);
	RequestModel(-453112275);
	RequestModel(-84503767);
	RequestModel(-508471291);
	RequestModel(1087863836);

	emitNet("TL:requestTLdict");

	emit("chat:addSuggestion", "/TLset", "Set/ reset a TL when standing at control panels, alternatively use U");
	emit("chat:addSuggestion", "/TLcontrol", "Control a TL when in the seat or basket, alternatively use E");
	emit("chat:addSuggestion", "/TLenter", "Enter/ exit the seat or basket of a TL, alternatively use F");
	emit("chat:addSuggestion", "/TLlock", "Lock/ unlock a set TL when standing nearby");
	emit("chat:addSuggestion", "/TLx", "Used for issue finding and fixing");
})


// TL Values
var rot = 0;
var mp = 0;
var ext = 0;
var sp = 0;

var lightRot = 0;
var lightPitch = 0;

var localObjs = {};
var localLights = {};

var seatDict = "amb@code_human_train_driver@base";
var seatName = "sit";

var standDict = "anim@amb@business@weed@weed_inspecting_lo_med_hi@";
var standName = "weed_stand_base_inspector";

var clientTL = null;
var clientPos = null;
var controllingTL = false;
var showControls = false;


// Auxillary functions
function chatMessage(msg) {
	emit("chat:addMessage", {
		color: [255,100,0],
		multiline: true,
		args: ["TL Script", msg]
	});
}
function notify(msg) {
	AddTextEntry("TLNOTIFY", "~a~");
	BeginTextCommandThefeedPost("TLNOTIFY");
	AddTextComponentSubstringPlayerName(msg);
	EndTextCommandThefeedPostTicker(true, false);
}
function moveObject(object,coords,rot) {
	SetEntityCoords(object, coords[0], coords[1], coords[2]);
	SetEntityRotation(object, rot[0], rot[1], rot[2], 0, true);
}
function unitVector(a) {
	let mag = Math.sqrt(Math.pow(a[0],2) + Math.pow(a[1],2) + Math.pow(a[2],2));
	return [a[0] / mag, a[1] / mag, a[2] / mag];
}
function vectorResult(a, lambda, b) {
	return [
		a[0] + lambda * b[0], 
		a[1] + lambda * b[1], 
		a[2] + lambda * b[2]
	];
}
function distanceTwoPoints(a, b) {
	return Vdist(a[0], a[1], a[2], b[0], b[1], b[2]);
}
function spawnObject(hash, coords, rot) {
	RequestModel(hash);
	var obj = CreateObject(hash, 0, 0, 0, false); // true/false = network object? (other people see)
	FreezeEntityPosition(obj, true);
	SetEntityCollision(obj, true, false);
	moveObject(obj, coords, rot); // [Pitch, Roll, Yaw]
	
	return obj;
}
function calculateSectionCoords(ttOrigin, vehHeading, vehPitch, rot, mp, ext, sp, lightRot, lightPitch, setupSeq=0) {
	var pitch = mp + (Math.cos(rot) * vehPitch); // cos(rot) is to correct pitch on a slope
	var pitch2 = pitch + sp;
	var yaw = rot - vehHeading;
	
	// Lifting vehicle (hence, raising ttOrigin)
	if (setupSeq < 0.1) {
		ttOrigin[2] += 0.15 * (0.1 - setupSeq) / 0.1;
	}


	// Turntable Position Coords
	var dir_tt = unitVector([
		Math.sin(yaw + 0.1027),
		Math.cos(yaw + 0.1027),
		0
	]);
	var turntable = vectorResult(ttOrigin, -0.9751, dir_tt);
	turntable[2] += 0.65;
	
	
	// Ladder Origin
	var dir0 = unitVector([
		Math.sin(yaw),
		Math.cos(yaw),
		0
	]);
	var ladderOrigin = vectorResult(ttOrigin, -2.2, dir0);
	ladderOrigin[2] += 1.35; 
	

	// Ladder Sections (default positions)
	var dir1 = unitVector([
		Math.sin(yaw),
		Math.cos(yaw),
		Math.tan(pitch)
	]);
	// var D = vectorResult(ladderOrigin, 3.95, dir1); 
	var D = vectorResult(ladderOrigin, 4.4, dir1); 
	var C = vectorResult(ladderOrigin, 3.9, dir1);
	var B = vectorResult(ladderOrigin, 3.9, dir1);
	

	// Extension
	if (ext >= 8.52) {
		C = vectorResult(ladderOrigin, (ext - 8.52) / 2 + 3.9, dir1);
		B = vectorResult(ladderOrigin, ext - 8.52 + 3.9, dir1);
	}
	var A = vectorResult(ladderOrigin, ext + 2.55, dir1);
	

	// Secondary Arm
	var pos2 = vectorResult(ladderOrigin, ext + 5.9, dir1);
	var dir2 = unitVector([
		Math.sin(yaw),
		Math.cos(yaw),
		Math.tan(pitch2)
	]);
	
	var S = vectorResult(pos2, 2.03, dir2); 

	var part1 = 0.5987 * (pitch2 ** 5) - 0.0815 * (pitch2 ** 4) - 0.6018 * (pitch2 ** 3) + 0.0688 * (pitch2 ** 2) + 0.7349 * pitch2 - 0.0106; // Correcting basket positioning
	var part2 = 0.5173 * (pitch2 ** 6) - 0.0134 * (pitch2 ** 5) - 0.799 * (pitch2 ** 4) - 0.0486 * (pitch2 ** 3) + 0.7488 * (pitch2 ** 2) + 0.0504 * pitch2 + 0.9416;
	var N = vectorResult(pos2, 4.05 + part1 + setupSeq * 0.085, dir2);
	N[2] -= part2 - setupSeq * 0.44;

	
	// Hose
	var dir3 = unitVector([
		Math.sin(yaw + 0.18),
		Math.cos(yaw + 0.18),
		Math.tan(Math.PI / 2 * setupSeq)
	]);
	var hose = vectorResult(N, 1.08, dir3);
	hose[2] += 0.1;

	
	// Spotlight
	var dir4 = unitVector([
		Math.sin(yaw - 1.15),
		Math.cos(yaw - 1.15),
		Math.tan(0.43)
	]);
	var light = vectorResult(N, 1.24, dir4);
	var lightDir = unitVector([
		Math.sin(yaw + lightRot),
		Math.cos(yaw + lightRot),
		Math.tan(lightPitch)
	]);


	// Saving everything to a JS object
	return {
		"A":A,
		"B":B,
		"C":C,
		"D":D,
		"turntable":turntable,
		"pitch":pitch * 180 / Math.PI,
		"yaw":-yaw * 180 / Math.PI,
		"S":S,
		"basket":N,
		"hose": hose,
		"light": light,
		"lightDir": lightDir,
		"pitch2":pitch2 * 180 / Math.PI,
		"pitchb": -90 * (1 - setupSeq)
	};
}
function calculateStabCoords(vehCoords, vehRot, vehDirs, maxDowns, setupSeq=1) {
	// Calculate values
	var sideways = 0.1 + setupSeq * 2;
	var roll = -15;
	var down = [-0.05, -0.05, -0.05, -0.05];
	if (setupSeq > 0.4) {
		var lambda = (setupSeq - 0.4) / 0.6
		roll = -15 * (1 - lambda)
		maxDowns.forEach((elem, index) => {
			down[index] = -0.05 + lambda * (elem + 0.05);
		})
	}


	// Work out coords
	var front = vectorResult(vehCoords, 0.5, vehDirs[0]);
	var flb = vectorResult(front, -sideways, vehDirs[1]);
	var frb = vectorResult(front, sideways, vehDirs[1]);
	var flc = vectorResult(flb, down[0], vehDirs[2]);
	var frc = vectorResult(frb, down[1], vehDirs[2]);

	var rear = vectorResult(vehCoords, -3.723, vehDirs[0]);
	var rlb = vectorResult(rear, -sideways, vehDirs[1]);
	var rrb = vectorResult(rear, sideways, vehDirs[1]);
	var rlc = vectorResult(rlb, down[2], vehDirs[2]);
	var rrc = vectorResult(rrb, down[3], vehDirs[2]);


	// Vehicle stuff
	if (setupSeq > 0.9) {
		var h =  0.15 * (setupSeq - 0.9) / 0.1;
		var newCoords = vectorResult(vehCoords, h, vehDirs[2]);
	} else {
		var newCoords = vehCoords;
	}


	// Return as a JS object
	var stabilisers = {
		"fl": flc,
		"fr": frc,
		"rl": rlc,
		"rr": rrc,
		"rotr": [vehRot[0] * 180 / Math.PI, roll, vehRot[2] * 180 / Math.PI],
		"rotl": [-vehRot[0] * 180 / Math.PI, roll, vehRot[2] * 180 / Math.PI + 180],
		"newVehCoords": newCoords,
		"newVehRot": [vehRot[0] * 180 / Math.PI, 0, vehRot[2] * 180 / Math.PI]
	};

	return stabilisers;
}
function findMaxDown(b, upDir) {
	var tC =  vectorResult(b, -0.5, upDir);
	tC[2] += 1;
	var z = GetGroundZFor_3dCoord(tC[0], tC[1], tC[2] + 1, false)[1] + 0.45;

	return (z - b[2]) / upDir[2];
}
function getClosestVeh() {
	var pedCoords = GetEntityCoords(PlayerPedId());

	var closestDist = 7;
	var closestVeh = -1;

	GetGamePool("CVehicle").forEach((veh) => {
		var d = distanceTwoPoints(pedCoords, GetEntityCoords(veh));
		if (d < closestDist) {
			closestDist = d;
			closestVeh = veh;
		}
	})

	return closestVeh;
}
function syncExtra(nid, extraId, state) {
	emitNet("TL:syncExtraEmit", nid, extraId, state);
}
RegisterNetEvent("TL:syncExtraReturn");
on("TL:syncExtraReturn", (nid, extraId, state) => {
	var veh = NetworkGetEntityFromNetworkId(parseInt(nid));
	SetVehicleExtra(veh, extraId, state);
})
RegisterNetEvent("TL:playSoundReturn");
on("TL:playSoundReturn", (nid, type, soundOrigin, open) => {
	var distance = distanceTwoPoints(GetEntityCoords(PlayerPedId()), soundOrigin); 
	if (distance < 10) {
		var falloff = 1 - distance / 10;
		if (IsPedInAnyVehicle(PlayerPedId(), false)) { falloff *= 0.4 };
		SendNUIMessage({"type":"sound", "data": {"nid": nid, "type": type, "vol": 0.45 * falloff, "open": open}});
	}
})
function getOrderedTLdistances() {
	var pedCoords = GetEntityCoords(PlayerPedId());
	var TLdists = [];
	
	Object.keys(TLdict).forEach((nid) => {
		TLdists.push([
			parseInt(nid),
			distanceTwoPoints(pedCoords, TLdict[nid]["vehCoords"])
		]);
	});

	return TLdists.sort((a, b) => (a[1] < b[1]) ? -1 : 1); // Sort in order of distance
}
function getOrderedTLnids() {
	return getOrderedTLdistances().map(e => e[0]); // Return as array of only nids
}
function getClosestTL(within=99999) {
	var closest = getOrderedTLdistances()[0];
	if (closest[0] != undefined && closest[1] < within) {
		return closest;
		// Made and developed for Launcher Leaks!!
	} else {
		return false;
	}
}

// Receiving TLdict
var TLdict = {};
RegisterNetEvent("TL:emitTLdict");
on("TL:emitTLdict", (dict) => {
	TLdict = dict;
})

RegisterNetEvent("TL:emitTLentry");
on("TL:emitTLentry", (nid, entry) => {
	if (nid in TLdict) {
		// # Adding to an entry

		// Loop through each property
		Object.keys(TLdict[nid]).forEach((key) => {
			// If in uploaded entry get ready to replace
			if (key in entry) {

				// Check if property is object (eg; vals)
				if (typeof TLdict[nid][key] == "object") {

					Object.keys(TLdict[nid][key]).forEach((key2) => {
						if (key2 in entry[key]) {
							TLdict[nid][key][key2] = entry[key][key2];

						}
					})
				} else {
					TLdict[nid][key] = entry[key];
				}
			}
		})
	} else {
		// # Creating a new entry

		if ("ttOrigin" in entry) {
			// Check that is isn't a stray entry being uploaded
			TLdict[nid] = entry;
		}

	}
})

RegisterNetEvent("TL:deleteTLobjs");
on("TL:deleteTLobjs", (nid) => {
	if (nid in TLdict) {
		delete TLdict[nid];
	}

	if (nid in localObjs) {
		Object.keys(localObjs[nid]).forEach((section) => {
			DeleteEntity(localObjs[nid][section]);

		})

		delete localObjs[nid];
	}

	var veh = NetworkGetEntityFromNetworkId(parseInt(nid));
	FreezeEntityPosition(veh, false);
	SetVehicleDoorsLocked(veh, 1);
})


// Interval functions
var setupParams = [];
var setupInterval = false;
var setupCounter = 0;
var setupTime = 7;
function setupTick(nid, veh, vehCoords, ttOrigin, vehRot, vehDirs, maxDowns, setup) {
	if (setupCounter <= setupTime * 50) {
		// Work out progress (number between 0 and 1)
		var progress = setupCounter / (setupTime * 50);
		if (!setup) {
			// Packing up, decrease progress with time
			progress = 1 - progress;
		}

		// Calculate basket and stabiliser positions
		var positions = calculateSectionCoords(
			[...ttOrigin], vehRot[2], vehRot[0],
			0, 0, 0, 0, 0, 0,
			1 - progress
		);
		var stabilisers = calculateStabCoords(
			vehCoords, vehRot, vehDirs, maxDowns, progress
		);

		// Upload them to TLdict
		var entry = {
			positions,
			stabilisers
		};
		emitNet("TL:uploadTLentry", nid, entry);

	} else {
		// Catch and cancel interval if TL has already been deleted
		if (TLdict[nid] == undefined) {
			setupInterval = false;
			setupParams = [];
			return;
		}

		// Don't delete objs if someone has got back into the seat
		if (TLdict[nid]["occupants"]["seat"] && !setup) {
			return;
		}

		// Stop this interval once it has all completed
		setupInterval = false;
		setupParams = [];

		if (setup) {
			emitNet("TL:uploadTLentry", nid, {"ready": true, "rpm": 0.2});
		} else {
			// # If packing up TL: delete TL(objs), TLdict entry and respawn extras

			// Delete entry and delete TL(objs)
			emitNet("TL:deleteTL", nid);

			// Enable ladder extra, unfreeze TL(veh) and unlock doors
			syncExtra(nid, 5, false);
			syncExtra(nid, 10, false);
			FreezeEntityPosition(veh, false);
			SetVehicleDoorsLocked(veh, 1);
		}

	}

	setupCounter += 1;
}

var TLBuffer = [0, 0, 0, 0, 0, 0];
function controlTick() {
	// # Controls
	
	if (!TLdict[clientTL]["ready"]) {
		return;
	}

	var l1 = 3.7;
	if (ext <= 3) {
		var l0 = 9;
	} else {
		var l0 = ext + 6;
	}
	var clearance = GetEntityHeightAboveGround(localObjs[clientTL]["basket"]);
	var sp_min = Math.max(...[-0.8727-mp, -1.5708]);

	if (IsControlPressed(0, 35)) { // D
		if (rot < 2.042 || rot > 3.6) {
			rot += 0.045 / (l0 * Math.cos(mp) + l1 * Math.cos(mp+sp));
			if (rot >= 6.283) { rot = 0 };
		}
	} 
	if (IsControlPressed(0, 34)) { // A
		if (rot < 2.2 || rot > 3.770) {
			rot -= 0.045 / (l0 * Math.cos(mp) + l1 * Math.cos(mp+sp));
			if (rot <= 0) { rot = 6.283 };
		}
	} 
	if (IsControlPressed(0, 32)) { // W
		if (mp < 1.309) {
			mp += 0.03 / Math.sqrt(l0**2 + l1**2 + 2 * l0 * l1 * Math.cos(sp));
		} else {
			mp = 1.309
		}
	} 
	if (IsControlPressed(0, 33)) { // S
		if (clearance > 0.2 && sp > sp_min && ((mp > -0.2618 && rot > 0.5934 && rot < 5.6549) || mp > 0.001 && (rot < 0.5934 || rot > 5.6549))) {
			mp -= 0.03 / Math.sqrt(l0**2 + l1**2 + 2 * l0 * l1 * Math.cos(sp));
		} else if (clearance > 0.2 && sp > sp_min && rot > 0.5934 && rot < 5.6549) {
			mp = -0.2618;
		}
	} 
	if (IsControlPressed(0, 131)) { // L Shift
		if (ext < 22.96 && clearance > 0.1) {
			ext += 0.03;
		} else if (clearance > 0.1) {
			ext = 23;
		}
	} 
	if (IsControlPressed(0, 132)) { // L Ctrl
		if (ext > 3.73 && clearance > 0.1) {
			ext -= 0.03;
		} else if (ext >= 0.03 && sp > -0.01 && clearance > 0.2) {
			ext -= 0.03;
			sp = 0;
		} else if (sp > -0.01 && clearance > 0.2) {
			ext = 0;
		}
	} 
	if (IsControlPressed(0, 38)) { // E
		if (sp <= -0.01 / l1) {
			sp += 0.025 / l1;
		} else {
			sp = 0;
		}
	} 
	if (IsControlPressed(0, 44)) { // Q
		if (ext > 3.7 && sp > sp_min && clearance > 0.2) {
			sp -= 0.025 / l1;
		} else if (ext > 3.7 && clearance > 0.2) {
			sp = sp_min;
		}
	}

	// Light controls
	if (TLdict[clientTL]["spotlight"]) {
		if (IsControlPressed(0, 175)) { // Right arrow
			if (lightRot < 1.5708) {
				lightRot += 0.002;
			}
		}
		if (IsControlPressed(0, 174)) { // Left arrow
			if (lightRot > -1.5708) {
				lightRot -= 0.002;
			}
			
		}
		if (IsControlPressed(0, 172)) { // Up arrow
			if (lightPitch < 1.4835) {
				lightPitch += 0.002;
			}
		}
		if (IsControlPressed(0, 173)) { // Down arrow
			if (lightPitch > -1.4835) {
				lightPitch -= 0.002;
			}
		}
	}

	// Check for change, if yes calc new positions & upload
	if (![rot, mp, ext, sp, lightRot, lightPitch].every((val, index) => val === TLBuffer[index])) {
		// Engine revving
		var diffs = [rot, mp, ext, sp].filter((v,i) => v != TLBuffer[i]).length; // Num of differences
		var rpm = 0.2;
		if (diffs == 4) {
			rpm = 1;
		} else if (diffs == 3) {
			if (mp != TLBuffer[1]) {
				rpm = 1;
			} else {
				rpm = 0.9;
			}
		} else if (diffs == 2) {
			if (mp != TLBuffer[1]) {
				rpm = 0.95;
			} else if (rot != TLBuffer[0]) {
				rpm = 0.85;
			} else {
				rpm = 0.8;
			}
		} else if (diffs == 1) {
			if (mp != TLBuffer[1]) {
				rpm = 0.9;
			} else if (rot != TLBuffer[0]) {
				rpm = 0.8;
			} else {
				rpm = 0.7;
			}
		}

		TLBuffer = [rot, mp, ext, sp, lightRot, lightPitch];

		var positions = calculateSectionCoords(
			[...TLdict[clientTL]["ttOrigin"]], TLdict[clientTL]["vehRot"][2], TLdict[clientTL]["vehRot"][0],
			rot, mp, ext, sp, lightRot, lightPitch
		);

		var entry = {
			"vals": {
				"rot": rot,
				"mp": mp,
				"ext": ext,
				"sp": sp,
				"lightRot": lightRot,
				"lightPitch": lightPitch
			},
			positions,
			"clearance": clearance,
			"rpm": rpm
		};
		emitNet("TL:uploadTLentry", clientTL, entry);
	} else if (TLdict[clientTL]["rpm"] != 0.2) {
		emitNet("TL:uploadTLentry", clientTL, {"rpm": 0.2});
	}

}

function intervalFunction() {
	// Setup Tick
	if (setupInterval && setupParams.length == 8) {
		setupTick(...setupParams);
	}

	// Control Tick
	if (controllingTL) {
		controlTick();
	}

	// Looping through TLdict to move objects, light, attach peds, send NUI, etc
	const coords = GetEntityCoords(PlayerPedId());
	Object.keys(TLdict).forEach((nid) => {

		// Check that TL is 600m or less away 
		if (distanceTwoPoints(coords, TLdict[nid]["ttOrigin"]) <= 600) {
			
			// ## Positioning objects
			var positions = TLdict[nid]["positions"];
			var stabilisers = TLdict[nid]["stabilisers"];
			var veh = NetworkGetEntityFromNetworkId(parseInt(nid));
			if (!(nid in localObjs)) {
				// # Need to spawn objects
				
				localObjs[nid] = {};
				localObjs[nid]["turntable"] = spawnObject(1234380931, positions["turntable"], [0, 0, positions["yaw"]]);
				localObjs[nid]["D"] = spawnObject(-623969841, positions["D"], [positions["pitch"], 0, positions["yaw"]]);
				localObjs[nid]["C"] = spawnObject(-939994077, positions["C"], [positions["pitch"], 0, positions["yaw"]]);
				localObjs[nid]["B"] = spawnObject(2001253060, positions["B"], [positions["pitch"], 0, positions["yaw"]]);
				localObjs[nid]["A"] = spawnObject(1687915882, positions["A"], [positions["pitch"], 0, positions["yaw"]]);
				localObjs[nid]["S"] = spawnObject(-453112275, positions["S"], [positions["pitch2"], 0, positions["yaw"]]);
				localObjs[nid]["basket"] = spawnObject(-84503767, positions["basket"], [positions["pitchb"], 0, positions["yaw"]]);
				localObjs[nid]["hose"] = spawnObject(1087863836, positions["hose"], [positions["pitchb"], 0, positions["yaw"]]);

				localObjs[nid]["stab_fr"] = spawnObject(-508471291, stabilisers["fr"], stabilisers["rotr"]);
				localObjs[nid]["stab_fl"] = spawnObject(-508471291, stabilisers["fl"], stabilisers["rotl"]);
				localObjs[nid]["stab_rr"] = spawnObject(-508471291, stabilisers["rr"], stabilisers["rotr"]);
				localObjs[nid]["stab_rl"] = spawnObject(-508471291, stabilisers["rl"], stabilisers["rotl"]);

				FreezeEntityPosition(veh, true);
				SetEntityCoordsNoOffset(veh, stabilisers["newVehCoords"][0], stabilisers["newVehCoords"][1], stabilisers["newVehCoords"][2]);
				SetEntityRotation(veh, stabilisers["newVehRot"][0], stabilisers["newVehRot"][1], stabilisers["newVehRot"][2], 0, true);
				SetVehicleEngineOn(veh, true, true, false);
				SetVehicleDoorsLocked(veh, 10);


			} else {
				// # Only need to move the objects

				moveObject(localObjs[nid]["turntable"], positions["turntable"], [0, 0, positions["yaw"]]);
				moveObject(localObjs[nid]["D"], positions["D"], [positions["pitch"], 0, positions["yaw"]]);
				moveObject(localObjs[nid]["C"], positions["C"], [positions["pitch"], 0, positions["yaw"]]);
				moveObject(localObjs[nid]["B"], positions["B"], [positions["pitch"], 0, positions["yaw"]]);
				moveObject(localObjs[nid]["A"], positions["A"], [positions["pitch"], 0, positions["yaw"]]);
				moveObject(localObjs[nid]["S"], positions["S"], [positions["pitch2"], 0, positions["yaw"]]);
				moveObject(localObjs[nid]["basket"], positions["basket"], [positions["pitchb"], 0, positions["yaw"]]);
				moveObject(localObjs[nid]["hose"], positions["hose"], [positions["pitchb"], 0, positions["yaw"]]);

				
				moveObject(localObjs[nid]["stab_fr"], stabilisers["fr"], stabilisers["rotr"]);
				moveObject(localObjs[nid]["stab_fl"], stabilisers["fl"], stabilisers["rotl"]);
				moveObject(localObjs[nid]["stab_rr"], stabilisers["rr"], stabilisers["rotr"]);
				moveObject(localObjs[nid]["stab_rl"], stabilisers["rl"], stabilisers["rotl"]);

				if (!TLdict[nid]["ready"]) {
					SetEntityCoordsNoOffset(veh, stabilisers["newVehCoords"][0], stabilisers["newVehCoords"][1], stabilisers["newVehCoords"][2]);
					SetEntityRotation(veh, stabilisers["newVehRot"][0], stabilisers["newVehRot"][1], stabilisers["newVehRot"][2], 0, true);
				}

			}

			// Revving engine (RPMs)
			if (veh != 0) {
				SetVehicleCurrentRpm(veh, TLdict[nid]["rpm"]);
			}

			// Spotlight
			if (TLdict[nid]["spotlight"]) {
				if (!(nid in localLights)) {
					localLights[nid] = {};
					localLights[nid]["coords"] = positions["light"];
					localLights[nid]["dir"] = positions["lightDir"];
				} else {
					localLights[nid]["coords"] = positions["light"];
					localLights[nid]["dir"] = positions["lightDir"];
				}
			} else {
				if (nid in localLights) {
					delete localLights[nid];
				}
			}


			// ## Attaching 
			if (nid == clientTL) {
				if (clientPos == "seat") {
					// # Seat

					// Positioning
					var headingDir = TLdict[nid]["vals"]["rot"] - TLdict[nid]["vehRot"][2] - 2.3;
					var posCoords = vectorResult([0, 0, 0], 1.23, [
						Math.sin(headingDir),
						Math.cos(headingDir),
						0
					]);
					posCoords[2] += 0.16;
	
					// Attaching and animation
					AttachEntityToEntity(PlayerPedId(), localObjs[nid]["turntable"], -1, posCoords[0], posCoords[1], posCoords[2], 0, 0, positions["yaw"], false, false, true, true, 0, false);
					var loadAnimLoop = setInterval(() => {
						if (HasAnimDictLoaded(seatDict)) {
							TaskPlayAnim(PlayerPedId(), seatDict, seatName, 125.0, 125.0, -1, 1, 1, false, false, false);
	
							clearInterval(loadAnimLoop);
						}
					}, 10);

				} else if (clientPos == "basket1" || clientPos == "basket2" || clientPos == "basket3") {	
					// # Basket 

					// Positioning 
					if (clientPos == "basket1") {
						var headingDir = TLdict[nid]["vals"]["rot"] - TLdict[nid]["vehRot"][2] + 0.75;
						var posCoords = vectorResult([0, 0, 0], 0.75, [ 
							Math.sin(headingDir),
							Math.cos(headingDir),
							0
						]);
	
					} else if (clientPos == "basket2") {
						var headingDir = TLdict[nid]["vals"]["rot"] - TLdict[nid]["vehRot"][2] - 0.67;
						var posCoords = vectorResult([0, 0, 0], 0.7, [ 
							Math.sin(headingDir),
							Math.cos(headingDir),
							0
						]);
	
					} else {
						var headingDir = TLdict[nid]["vals"]["rot"] - TLdict[nid]["vehRot"][2] + 0.2; 
						var posCoords = vectorResult([0, 0, 0], 0.25, [ 
							Math.sin(headingDir),
							Math.cos(headingDir),
							0
						]);
	
					}
					posCoords[2] += 1;
	
					// Attaching and animation
					AttachEntityToEntity(PlayerPedId(), localObjs[nid]["basket"], -1, posCoords[0], posCoords[1], posCoords[2], 0, 0, positions["yaw"], false, false, true, true, 0, false);
					var loadAnimLoop = setInterval(() => {
						if (HasAnimDictLoaded(standDict)) {
							TaskPlayAnim(PlayerPedId(), standDict, standName, 125.0, 125.0, -1, 1, 1, false, false, false);
	
							clearInterval(loadAnimLoop);
						}
					}, 10);
				}
			}


			// Control display
			if (nid == clientTL && showControls) {
				SendNUIMessage({"type": "update", "data": {...TLdict[nid], "controllingTL": controllingTL}});
			}


			// Help text
			var text = "";
			if (controllingTL) {
				text = "Press ~INPUT_RELOAD~ to stop controlling TL";
			} else if (clientTL != null && !TLdict[nid]["operator"]) {
				if (clientPos == "seat") {
					text = "Press ~INPUT_ENTER~ to exit seat or ~INPUT_RELOAD~ to control TL";
				} else {
					text = "Hold ~INPUT_CELLPHONE_LEFT~ or ~INPUT_CELLPHONE_RIGHT~ then press ~INPUT_ENTER~ to exit the basket";
				}
			} else if (clientTL != null) {
				if (clientPos == "seat") {
					text = "Press ~INPUT_ENTER~ to exit seat";
				} else {
					text = "Hold ~INPUT_CELLPHONE_LEFT~ or ~INPUT_CELLPHONE_RIGHT~ then press ~INPUT_ENTER~ to exit the basket";
				}
			} else if (distanceTwoPoints(coords, TLdict[nid]["positions"]["basket"]) <= 3 && !TLdict[nid]["basketLock"] && !(TLdict[nid]["occupants"]["basket1"] && TLdict[nid]["occupants"]["basket2"] && TLdict[nid]["occupants"]["basket3"])) {
				text = "Press ~INPUT_ENTER~ to get into basket";
			}

			if (text != "") {
				AddTextEntry("TLHELP_BASKETSEAT", "~a~");
				BeginTextCommandDisplayHelp("TLHELP_BASKETSEAT");
				AddTextComponentSubstringPlayerName(text);
				EndTextCommandDisplayHelp(0, false, true, 0);
			}

		} else {
			
			// # If objects exist, delete them
			if (nid in localObjs) {
				Object.keys(localObjs[nid]).forEach((section) => {
					DeleteEntity(localObjs[nid][section]);
		
				})

				delete localObjs[nid];
			}
			if (nid in localLights) {
				delete localLights[nid];
			}
		}
	})
}

// Main interval loop
setInterval(() => {
	intervalFunction();
}, 20);


// Text Commands
function TLset() {
	if (setupInterval) {
		notify("Another TL is currently being set/ reset by you, please wait");
		return;
	}

	// Get details
	const ped = PlayerPedId();
	var veh = -1;

	if (IsPedInAnyVehicle(ped, false)) {
		// # Ped is in a vehicle

		veh = GetVehiclePedIsIn(ped, false);
		if (GetEntityModel(veh) != GetHashKey("LFB12")) {
			notify("Invalid vehicle");
			return;
		}

	} else {
		// # Ped is not in a vehicle -- check that they are at the back of a TL

		veh = getClosestVeh();
		if (GetEntityModel(veh) != GetHashKey("LFB12")) {
			notify("No valid vehicle found nearby");
			return;
		}

		if (distanceTwoPoints(GetEntityCoords(ped), vectorResult(GetEntityCoords(veh), -4.5, GetEntityForwardVector(veh))) > 2) {
			notify("You are not close enough to valid TL controls");
			return;
		}
		if (!IsVehicleExtraTurnedOn(veh, 9)) {
			notify("Control panels are not open");
			return;
		}

	}
	var nid = parseInt(NetworkGetNetworkIdFromEntity(veh));
	
	if (TLdict[nid] != undefined) {
		// # Packing up

		// Check that no one is in TL(objs)
		if (!Object.values(TLdict[nid]["occupants"]).every((e) => e == false)) {
			notify("People are still in the TL");
			return;
		}

		// Check that everything is close to 0
		var notCentre = [];
		if (TLdict[nid]["vals"]["rot"] > 0.035 && TLdict[nid]["vals"]["rot"] < 6.25) {
			notCentre.push("rot");
		}
		if (TLdict[nid]["vals"]["mp"] > 0.035 || TLdict[nid]["vals"]["mp"] < -0.035) {
			notCentre.push("mp");
		}
		if (TLdict[nid]["vals"]["ext"] > 0.1) {
			notCentre.push("ext");
		}
		if (TLdict[nid]["vals"]["sp"] < -0.02) {
			notCentre.push("sp");
		}
		if (notCentre.length > 0) {
			notify(`Ladder is not centred (${notCentre.join(", ")})`);
			return;
		}
		emitNet("TL:uploadTLentry", nid, {"vals": {"rot": 0, "mp": 0}, "basketLock": true, "spotlight": false, "ready": false, "rpm": 0.8});
	
		// Rotate basket up and bring stabilisers in
		setupCounter = 0;
		setupParams = [nid, veh, [...TLdict[nid]["vehCoords"]], [...TLdict[nid]["ttOrigin"]], [...TLdict[nid]["vehRot"]], GetEntityMatrix(veh), [...TLdict[nid]["maxDowns"]], false];
		setTimeout(() => {
			setupInterval = true;
		}, 20);

	} else {
		// # Setting up
		
		// Getting vehicles values
		var vehCoords = GetEntityCoords(veh);
		var vehRot = [
			GetEntityPitch(veh) * Math.PI / 180, 		// [0] pitch
			0,											// [1] roll
			GetEntityHeading(veh) * Math.PI / 180		// [2] yaw
		];
		var vehDirs = GetEntityMatrix(veh);
		
		if (Math.abs(vehRot[0]) > 0.1396) { // 8°
			notify(`Vehicle slope to sleep (${(vehRot[0] * 180 / Math.PI).toFixed(2)}°)`);
			return;
		}
	
		// Disable ladder extra, freeze TL(veh) and lock doors
		syncExtra(nid, 5, true);
		syncExtra(nid, 8, true);
		syncExtra(nid, 9, false);
		syncExtra(nid, 10, true);
		FreezeEntityPosition(veh, true);
		SetVehicleDoorsLocked(veh, 10);
		SetVehicleEngineOn(veh, true, true, false);

		// Calculate turntableOrigin
		var ttOrigin = vectorResult(vehCoords, -1.7, vehDirs[0]);
		ttOrigin = vectorResult(ttOrigin, 1.1, vehDirs[2]);

		// Calculate distance to move stabilisers down
		var maxDowns = [0, 0, 0, 0];
		var front = vectorResult(vehCoords, 0.5, vehDirs[0]);
		maxDowns[0] = findMaxDown(vectorResult(front, -3.2, vehDirs[1]), vehDirs[2]);
		maxDowns[1] = findMaxDown(vectorResult(front, 3.2, vehDirs[1]), vehDirs[2]);
		var rear = vectorResult(vehCoords, -3.723, vehDirs[0]);
		maxDowns[2] = findMaxDown(vectorResult(rear, -3.2, vehDirs[1]), vehDirs[2]);
		maxDowns[3] = findMaxDown(vectorResult(rear, 3.2, vehDirs[1]), vehDirs[2]);

		// Calculate initial positions
		var positions = calculateSectionCoords(
			[...ttOrigin], vehRot[2], vehRot[0],
			0, 0, 0, 0, 0, 0,
			1
		);
		var stabilisers = calculateStabCoords(
			vehCoords, vehRot, vehDirs, maxDowns, 0
		);

		// Create & upload TLdict entry
		var entry = {
			"nid": nid,
			"vehCoords": vehCoords,
			"ttOrigin": ttOrigin,
			"vehRot": vehRot, // pitch, roll, yaw,
			"ready": false,
			"vals": {
				"rot": 0,
				"mp": 0,
				"ext": 0,
				"sp": 0,
				"lightRot": 0,
				"lightPitch": 0
			},
			positions,
			stabilisers,
			maxDowns,
			"rpm": 0.8,
			"clearance": -1,
			"operator": false,
			"occupants": {
				"seat": false,
				"basket1": false,
				"basket2": false,
				"basket3": false
			},
			"basketLock": true,
			"spotlight": false
		};
		emitNet("TL:uploadTLentry", nid, entry);

		// Rotate basket down and deploy stabilisers
		setupCounter = 0;
		setupParams = [nid, veh, vehCoords, ttOrigin, vehRot, vehDirs, maxDowns, true];
		setTimeout(() => {
			setupInterval = true;
		}, 20);
	}
}
RegisterCommand("TLset", () => {
	TLset();
})

function TLenter(pos=null) {
	if (clientTL == null) {
		// # Not in a TL(obj), entering

		// Get details
		const ped = PlayerPedId();
		const coords = GetEntityCoords(ped);
		var withinRange = [];

		// Loop through each TLdict entry
		Object.keys(TLdict).forEach((nid) => {
			// Calculate distance to seat and basket
			var d1 = distanceTwoPoints(coords, TLdict[nid]["ttOrigin"]);
			var d2 = distanceTwoPoints(coords, TLdict[nid]["positions"]["basket"]);

			// If within 4m, add to withinRange array
			if (d1 < 4 && !TLdict[nid]["occupants"]["seat"]) {
				withinRange.push([nid, "seat", d1]);
			}

			if (d2 < 4 && !TLdict[nid]["occupants"]["basket1"] && !TLdict[nid]["basketLock"]) {
				withinRange.push([nid, "basket1", d2]);
			}
			if (d2 < 4 && !TLdict[nid]["occupants"]["basket2"] && !TLdict[nid]["basketLock"]) {
				withinRange.push([nid, "basket2", d2]);
			}
			if (d2 < 4 && !TLdict[nid]["occupants"]["basket3"] && !TLdict[nid]["basketLock"]) {
				withinRange.push([nid, "basket3", d2]);
			}

		})

		// Go through withinRange array
		if (withinRange.length == 0) {
			return;

		} else {
			ClearPedTasksImmediately(ped);

			// Sort array so that closest is at index 0
			withinRange.sort((a, b) => (a[2] < b[2]) ? -1 : 1);

			if (pos != null) {
				// Attach to specific position
				withinRange.forEach((option) => {
					if (option[1] == pos && option[0] == withinRange[0][0]) {
						clientTL = option[0];
						clientPos = option[1];
					}
				})

				if (clientTL == null) {
					notify("That position is not free/ valid");
					return;
				}
			} else {
				// Attach to closest and first available position
				clientTL = withinRange[0][0];
				clientPos = withinRange[0][1];
			}

			if (clientPos == "seat") {
				SendNUIMessage({"type": "ui", "data": "seat"});
				showControls = true;
				RequestAnimDict(seatDict);
			} else {
				RequestAnimDict(standDict);
			}

			emitNet("TL:uploadTLentry", clientTL, {"occupants": {[clientPos]: NetworkGetNetworkIdFromEntity(PlayerPedId())}}); 

		}
		
	} else {
		// # Currently in a TL(obj), exiting
	
		if (controllingTL) {
			notify("You are currently controlling a TL");
			return;
		} else {
			if (pos == "exitleft" || pos == "exitright") {
				var headingDir = TLdict[clientTL]["vals"]["rot"] - TLdict[clientTL]["vehRot"][2];
				if (pos == "exitleft") {
					headingDir -= 0.6;
				} else {
					headingDir += 0.6;
				}

				var posCoords = vectorResult([0, 0, 0], 1.6, [ 
					Math.sin(headingDir),
					Math.cos(headingDir),
					0
				]);
				posCoords[2] += 1;

				AttachEntityToEntity(PlayerPedId(), localObjs[clientTL]["basket"], -1, posCoords[0], posCoords[1], posCoords[2], 0, 0, TLdict[clientTL]["positions"]["yaw"], false, false, true, true, 0, false);
			}

			DetachEntity(PlayerPedId(), false, false);
			emitNet("TL:uploadTLentry", clientTL, {"occupants": {[clientPos]: false}});
			
			clientTL = null;
			setTimeout(() => {
				if (clientPos == "seat") {
					SendNUIMessage({"type": "ui", "data": false});
					showControls = false;
					StopAnimTask(PlayerPedId(), seatDict, seatName, 125.0);
				} else {
					StopAnimTask(PlayerPedId(), standDict, standName, 125.0);
				}
				clientPos = null;

				if (["basket1","basket2","basket3"].includes(pos)) {
					TLenter(pos);
				}

			}, 100); // Have to wait incase you stop anim then TLdict is downloaded again too soon after
		}
	}
}
RegisterCommand("TLenter", (_, args) => {
	if ([undefined,"basket1","basket2","basket3","exitleft","exitright"].includes(args[0])) {
		TLenter(args[0]);
	} else {
		notify("Invalid position");
	}
})

function TLcontrol() {
	if (clientTL == null) {
		notify("You must be in a TL to control one")
		return;

	} else {
		if (controllingTL) {
			if (clientPos != "seat") {
				SendNUIMessage({"type": "ui", "data": false});
				showControls = false;
			}
			controllingTL = false;
			emitNet("TL:uploadTLentry", clientTL, {"operator": false});

		} else {
			if (TLdict[clientTL]["operator"]) {
				notify("Someone else is already controlling this TL")
				return;
				
			} else {
				emitNet("TL:uploadTLentry", clientTL, {"operator": NetworkGetNetworkIdFromEntity(PlayerPedId())});

				// Setting local variables
				rot = TLdict[clientTL]["vals"]["rot"];
				mp = TLdict[clientTL]["vals"]["mp"];
				ext = TLdict[clientTL]["vals"]["ext"];
				sp = TLdict[clientTL]["vals"]["sp"];
				lightRot = TLdict[clientTL]["vals"]["lightRot"];
				lightPitch = TLdict[clientTL]["vals"]["lightPitch"];
				TLBuffer = [rot, mp, ext, sp, lightRot, lightPitch];

				SendNUIMessage({"type": "ui", "data": clientPos});
				showControls = true;
				controllingTL = true;

			}
		}
	}
}
RegisterCommand("TLcontrol", () => {
	TLcontrol();
})

function TLtoggleBasketLock() {
	if (TLdict[clientTL]["ready"]) {
		var toggled = !TLdict[clientTL]["basketLock"];
		emitNet("TL:uploadTLentry", clientTL, {"basketLock": toggled});
	}
}
function TLtoggleLight() {
	var toggled = !TLdict[clientTL]["spotlight"];
	emitNet("TL:uploadTLentry", clientTL, {"spotlight": toggled});
}

function TLtoggleDoorLock() {
	var veh = getClosestVeh();
	if (GetEntityModel(veh) != GetHashKey("LFB12")) {
		notify("No valid vehicle found nearby");
		return;
	}

	var nid = NetworkGetNetworkIdFromEntity(veh);

	if (TLdict[nid] != undefined) {
		if (GetVehicleDoorLockStatus(veh) == 10) {
			// # Currently locked

			SetVehicleDoorsLocked(veh, 1);
			notify("TL unlocked");
		} else {
			// # Currently unlocked

			SetVehicleDoorsLocked(veh, 10);
			notify("TL locked");
		}
	}
}
RegisterCommand("TLlock", () => {
	TLtoggleDoorLock();
})


// Tick function
setTick(() => {

	if (IsControlJustReleased(0, 23) && !IsPedInAnyVehicle(PlayerPedId(), true)) { // F -- enter TL
		if (clientTL != null && !controllingTL) {
			if (IsControlPressed(0, 174)) {
				TLenter("exitleft");
				return;
			} else if (IsControlPressed(0, 175)) {
				TLenter("exitright");
				return;
			}
		}
		TLenter();
	}
	if (IsControlJustReleased(0, 45) && clientTL != null) { // R -- control TL
		TLcontrol();
	}
	if (IsControlJustReleased(0, 303) && controllingTL) { // U -- basket lock
		TLtoggleBasketLock();
	}
	if (IsControlJustReleased(0, 246) && controllingTL) { // Y -- toggle light
		TLtoggleLight();
	}
	Object.keys(localLights).forEach((nid) => {
		DrawLightWithRange(localLights[nid]["coords"][0], localLights[nid]["coords"][1], localLights[nid]["coords"][2], 255, 255, 255, 0.15, 10);
		DrawSpotLight(localLights[nid]["coords"][0], localLights[nid]["coords"][1], localLights[nid]["coords"][2], localLights[nid]["dir"][0], localLights[nid]["dir"][1], localLights[nid]["dir"][2], 255, 255, 255, 80, 0.5, 0, 25, 2);
	})

	// Toggle lockers (and stabilisers control panel) -- E 
	if (!IsPedInAnyVehicle(PlayerPedId(), true) && clientTL == null) {
		const veh = getClosestVeh();
		if (GetEntityModel(veh) == GetHashKey("LFB12")) {
			
			const pedCoords = GetEntityCoords(PlayerPedId());
			const vehCoords = GetEntityCoords(veh);
			if (distanceTwoPoints(pedCoords, vehCoords) < 5) {

				const vehDirs = GetEntityMatrix(veh);
				var left = vectorResult(vehCoords, -1.1, vehDirs[1]);
				var right = vectorResult(vehCoords, 1.1, vehDirs[1]);
				var nid = NetworkGetNetworkIdFromEntity(veh);

				[
					vectorResult(left, 1.5, vehDirs[0]),
					vectorResult(left, -0.9, vehDirs[0]),
					vectorResult(left, -3.2, vehDirs[0]),
					vectorResult(right, 1.5, vehDirs[0]),
					vectorResult(right, -0.9, vehDirs[0]),
					vectorResult(right, -3.2, vehDirs[0]),
					vectorResult(vehCoords, -4.5, vehDirs[0])
				].forEach((locker, index) => {
					var dist = distanceTwoPoints(locker, pedCoords);
					if (dist < 1.75) {
						if (index == 6) {
							var text = "Press ~INPUT_CONTEXT~ to toggle covers"
							if (IsVehicleExtraTurnedOn(veh, 9)) {
								if (TLdict[nid] != undefined) {
									text += " or ~INPUT_REPLAY_SCREENSHOT~ to reset TL";
								} else {
									text += " or ~INPUT_REPLAY_SCREENSHOT~ to set TL";
								}
							}
						} else if (dist < 1) {
							var text = "Press ~INPUT_CONTEXT~ to toggle locker";
						} else {
							var text = "";
						}

						if (text != "") {
							AddTextEntry("TLHELP_LOCKERS", "~a~");
							BeginTextCommandDisplayHelp("TLHELP_LOCKERS");
							AddTextComponentSubstringPlayerName(text);
							EndTextCommandDisplayHelp(0, false, true, 0);
						}


						if (index < 3 && IsControlJustReleased(0, 51) && dist < 1) { // E
							// # Left lockers
							
							var current = IsVehicleExtraTurnedOn(veh, 7);
							syncExtra(nid, 6, + !current);
							syncExtra(nid, 7, + current);
							emitNet("TL:playSoundEmit", nid, "lockers", locker, + current);
						} else if (index < 6 && IsControlJustReleased(0, 51) && dist < 1) { // E
							// # Right lockers

							var current = IsVehicleExtraTurnedOn(veh, 11);
							syncExtra(nid, 11, + current);
							syncExtra(nid, 12, + !current);
							emitNet("TL:playSoundEmit", nid, "lockers", locker, + current);
						} else if (IsControlJustReleased(0, 51)) { // E
							// # Rear flaps
							
							var current = IsVehicleExtraTurnedOn(veh, 9);
							syncExtra(nid, 8, + !current);
							syncExtra(nid, 9, + current);
							emitNet("TL:playSoundEmit", nid, "rearflaps", + !current);
						} else if (IsControlJustReleased(0, 303)) { // U -- TLset

							TLset();
						}
					}
				})
			}
		}
	}
})


// Issue finding and fixing 
RegisterCommand("TLx", (_, args) => {
	switch (args[0]) {
		case "myTL":
			notify(`Your TL id: ${clientTL}`);
			return;
		case "coords":
			var TLnids = getOrderedTLnids();
			var output = "\nid ~~ coords ~~ distance";
			TLnids.forEach((nid) => {
				var coords = [...TLdict[nid]["vehCoords"]].map(v => v.toFixed(0)).join(", ");
				var dist = distanceTwoPoints(GetEntityCoords(PlayerPedId()), TLdict[nid]["vehCoords"]).toFixed(1);
				output += `\n${nid} ~~ ${coords} ~~ ${dist}`;
			})

			chatMessage(output);
			return;
		case "closest":
			var closest = getClosestTL();
			notify(`Closest TL id: ${closest[0]} (${closest[1].toFixed(1)}m away)`);
			return;
		case "occu":
			var TLnids = getOrderedTLnids();
			var output = "\nid ~~ op ~~ seat ~~ b1 ~~ b2 ~~ b3";
			TLnids.forEach((nid) => {
				var op = TLdict[nid]["operator"];
				var occus = Object.values(TLdict[nid]["occupants"]).join(" ~~ ");
				output += `\n${nid} ~~ ${op} ~~ ${occus}`;
			})

			chatMessage(output);
			return;
		case "evict":
			// Checking position
			var pos = args[2];
			if (!["all", "op", "seat", "basket1", "basket2", "basket3"].includes(pos)) {
				notify("Invalid position");
				return;
			}

			// Checking nid
			if (args[1] == "cl") {
				var nid = getClosestTL(50)[0];
				
				if (!nid) {
					notify("No TL found within range");
					return;
				}
			} else {
				var nid = parseInt(args[1]);

				if (TLdict[nid] == undefined) {
					notify("TL not found");
					return;
				}
			}

			// Removing player from TLentry
			if (pos == "all") {
				emitNet("TL:uploadTLentry", nid, {
					"operator": false,
					"occupants": {
						"seat": false,
						"basket1": false,
						"basket2": false,
						"basket3": false
					}
				});
			} else if (pos == "op") {
				emitNet("TL:uploadTLentry", nid, {"operator": false});
			} else {
				emitNet("TL:uploadTLentry", nid, {"occupants": {[pos]: false}});
			}

			notify("Successfully evicted player(s)");
			return;
		case "exit":
			DetachEntity(PlayerPedId(), false, false);

			if (TLdict[clientTL] != undefined) {
				if (TLdict[clientTL]["occupants"][clientPos] == NetworkGetNetworkIdFromEntity(PlayerPedId())) {
					emitNet("TL:uploadTLentry", clientTL, {"occupants": {[clientPos]: false}});
				}
			}
			
			clientTL = null;
			setTimeout(() => {
				SendNUIMessage({"type": "ui", "data": false});
				showControls = false;
				StopAnimTask(PlayerPedId(), seatDict, seatName, 125.0);
				StopAnimTask(PlayerPedId(), standDict, standName, 125.0);

				clientPos = null;
			}, 100);

			notify("Animations cancelled and detached from TL");
			return;
		case "del":
			// Checking nid
			if (args[1] == "cl") {
				var closest = getClosestTL();
				
				// Closest must be within 50m (unless "force" parameter used)
				if (!closest || (closest[1] >= 50 && args[2] != "force")) {
					notify("No TL found within range");
					return;
				}

				var nid = closest[0];
			} else {
				var nid = parseInt(args[1]);

				if (TLdict[nid] == undefined) {
					notify("TL not found");
					return;
				}
			}

			// Check that no one is in TL (or "force" parameter used)
			if (!Object.values(TLdict[nid]["occupants"]).every((e) => e == false) && args[2] != "force") {
				notify("People are still in the TL");
				return;
			}

			emitNet("TL:deleteTL", nid);

			var veh = NetworkGetEntityFromNetworkId(nid);
			if (veh != -1) {
				syncExtra(nid, 5, false);
				syncExtra(nid, 10, false);
				FreezeEntityPosition(veh, false);
				SetVehicleDoorsLocked(veh, 1);
			}

			notify("Successfully deleted TL");
			return;
		case "forcesync":
			emitNet("TL:requestTLdict", -1);
			return;
		case "json":
			console.log("======");
			console.log(TLdict);
			console.log("======");
			return;
		case "objs":
			console.log("======");
			console.log(localObjs);
			console.log("======");
		default:
			return;
	}
})