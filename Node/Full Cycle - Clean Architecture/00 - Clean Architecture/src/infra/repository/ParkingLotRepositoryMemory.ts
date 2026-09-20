import ParkingLotAdapter from "../../adapter/ParkingLotAdapter"
import ParkingLot from "../../core/entity/ParkingLot"
import ParkingLotRepository from "../../core/repository/ParkingLotRepository"

export default class ParkingLotRepositoryMemory implements ParkingLotRepository {
  
    parkingLots = [
        {code: 'Shopping1', capacity: 5, open_hour: 8, close_hour: 20},
        {code: 'Shopping2', capacity: 10, open_hour: 8, close_hour: 20},
        {code: 'Shopping3', capacity: 10, open_hour: 8, close_hour: 20},
        {code: 'Shopping4', capacity: 10, open_hour: 8, close_hour: 20},

    ];
    parkedCars = [];


    getParkingLot(code: string): Promise<ParkingLot> {
        const parkingLotData = this.parkingLots.find(parkingLot => parkingLot.code === code )
        const parkingLot = ParkingLotAdapter.create(parkingLotData.code, parkingLotData.capacity, parkingLotData.open_hour, parkingLotData.close_hour)
        return Promise.resolve(parkingLot)
    }

    saveParkedCar(code: string,plate: string,date: Date): void {
        this.parkedCars.push({
            code,
            plate,
            date
        })
    }

}