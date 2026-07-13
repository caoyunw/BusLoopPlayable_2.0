# Garage Unity Extraction - 2026-07-13

## Source Scope

This note extracts the Unity garage mechanism from the source project for later BusLoop mechanic-lab implementation. It intentionally records relative Unity asset paths only.

- Prefab: `Assets/BusJam/Game/Bundleables/Prefabs/Garage.prefab`
- Core script: `Assets/BusJam/Game/Scripts/VehicleContainer/VehicleContainerGarage.cs`
- Out state: `Assets/BusJam/Game/Scripts/Vehicle/States/StateOutGarage.cs`
- Collision graph: `Assets/BusJam/Game/Scripts/VehicleContext/GarageContainerCollideInfo.cs`
- Counter UI: `Assets/BusJam/Game/Scripts/UI/GamePanel/Items/GarageCounterItem.cs`
- Config fields: `BusJamConfig.garageSize`, `garageParkPos`, `garageOutDelay`

## Mechanic Rule

Garage is a vehicle container. Vehicles assigned to a garage are hidden in a stack and leave one at a time when the garage front/door is clear.

The stock is loaded from level vehicles whose `containerType` is `Garage` and whose `containerId` matches the garage container id. Unity iterates the level vehicle list from the end to the beginning when building the garage list. `GetRemainVehicle()` also yields from the end to the beginning, so the effective next vehicle is the last item in the stored list.

The garage can start a release when:

- it still has stored vehicles;
- no vehicle is currently driving out;
- the collision graph reports that the door/front node has no outgoing blocker.

When release starts, Unity borrows the vehicle from the pool, hides it under the prefab `BusObject` transform, triggers the garage out state, plays `garage_out`, and updates the counter board to exclude the currently driving-out vehicle.

## Runtime Sequence

1. Loading creates each garage container from level `containers` with `type == Garage`.
2. `VehicleContainerGarage.Setup()` places the prefab at the authored container position/rotation and scales it by `GameScene.VehicleScale`.
3. Setup scans level vehicles and stores matching garage vehicle ids.
4. The collision graph creates five garage nodes: `HEAD`, `TAIL`, `DOOR`, `OUT`, and `BODY`.
5. If `DOOR` has no blocking exit nodes after graph setup, `OnFrontClear()` calls `TryDriveOutGarage()`.
6. `TryDriveOutGarage()` marks `DrivingOutVehicleId`, borrows the vehicle, calls `DriveOutGarage()`, plays `garage_out`, and refreshes the count board.
7. `StateOutGarage` waits `garageOutDelay`, activates the vehicle, plays the garage `Out` animation, then reparents the vehicle to its previous parent and jumps it to `StatePark`.
8. On state exit, `OnDriveOutComplete()` removes that id from garage stock and clears the driving flag.
9. The vehicle context receives `OnVehicleDriveOutGarageDone()` and treats the vehicle as newly entering the parking area.
10. If more garage vehicles remain and the door becomes clear again, the next vehicle is released.
11. Once all stock is out and the last released vehicle leaves the parking area, the garage hides its counter, plays `garage_clear`, and disables the garage object.

## Collision Model

Garage collision is more than a static rectangle. Unity represents the garage as a small graph:

- `HEAD`: logical start of the garage stock chain.
- `TAIL`: logical end of the stock chain.
- `DOOR`: the physical front area where vehicles can block release.
- `OUT`: the drive-out route area.
- `BODY`: the garage body obstacle.

The door box is positioned in front of the garage by half the garage depth plus half of the max vehicle depth. Its size is the max vehicle size. The body box uses `garageSize`.

During setup, parked vehicles and other containers add links to these nodes when their collision boxes overlap the door, drive-out path, or body. The garage stock vehicles are chained into the graph so hidden vehicles still participate in release order.

When a garage vehicle starts driving out, its graph node is rewired from the hidden-stock chain into `DOOR -> vehicle -> OUT`. This makes the out-going vehicle temporarily occupy the door/out path. When graph nodes are removed and `DOOR` has no outgoing blockers, the garage attempts the next release.

## Prefab Anchors And Feedback

`Garage.prefab` root has `VehicleContainerGarage`, an animator, and a feedback player. The feedback player references `Blackboard_Garage` and its Unity comment means "truck close flow".

Important child anchors:

- `InitPos`: local position `{ x: 0, y: 0.06799997, z: 0.037 }`
- `BusObject`: inactive child used as the temporary parent for the vehicle during out animation; local position `{ x: 0, y: 0.5083918, z: -0.1748478 }`, local rotation `{ x: 0, y: -1, z: 0, w: 0 }`, local scale `7.476354`
- `uiPos`: serialized into the `boardPos` field; local position `{ x: 0, y: 0.379, z: 0.015 }`
- `ParkPos`: local position `{ x: 0, y: 0, z: 0.70000005 }`

The animator controller is `Ani_Truck.controller`. `VehicleContainerGarage.PlayOutAnim()` resets `Out` and `Close`, triggers `Out`, then waits 1200 ms.

## Counter Board

`GarageCounterItem` displays remaining stored vehicles as text. It anchors to `boardPos`/`uiPos`, scales by `GameScene.VehicleScale`, and syncs its screen position for 60 active frames after setup.

The displayed count is:

`stored vehicle count - 1 if a vehicle is currently driving out`

That means the count drops as soon as a vehicle starts leaving the garage, not after the vehicle fully finishes the out animation.

## Web Lab Implementation Notes

For the current mechanic lab, garage should stay isolated in `src/mechanics/garage/` instead of becoming a large branch in `src/main.js`.

Minimum playable version:

- Extend level data with garage containers and hidden vehicle ids.
- During reset, remove garage vehicles from the visible parked vehicle set and store them in garage state.
- Add garage objects to snapshots so the scene can render garage shell, count board, and closed/empty state.
- Detect door/front blockers using the existing blocker model first; a full Unity-style five-node graph can come later if needed.
- When the front is clear and no garage vehicle is currently exiting, spawn/reveal the next vehicle at the garage outlet and run a short out animation into normal parked state.
- Update remaining count immediately when the vehicle begins exiting.
- Hide/deactivate the garage when stock is empty and the last released vehicle leaves.
- Include `garage_out` and `garage_clear` feedback hooks, even if the first pass uses placeholder audio/animation.

Focused tests should cover stock order, one-at-a-time release, blocked-door no-op, count-board decrement timing, final garage hide, reset behavior, and interaction with win/loss checks.
