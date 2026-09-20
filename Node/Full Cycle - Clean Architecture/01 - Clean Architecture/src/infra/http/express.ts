import Express from "express"
import GetParkingLot from "../../core/usecase/GetParkingLot"
import ParkingLotRepositoryMemory from "../repository/ParkingLotRepositoryMemory"
import ExpressAdapter from "../../adapter/ExpressAdapter"
import ParkingLotController from "../../controller/ParkingLotController"

const app=new Express()

app.get("/parkingLots/:code",ExpressAdapter.create(ParkingLotController.getParkingLot))

app.listen(3000)