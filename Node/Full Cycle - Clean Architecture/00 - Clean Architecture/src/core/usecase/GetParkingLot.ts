import ParkedCar from "../entity/ParkedCar"
import ParkingLotRepository from "../repository/ParkingLotRepository"

export default class GetParkingLot {


    constructor(private parkingLotRepository: ParkingLotRepository){

    }

    async execute (code: string) {
        // Casos de Usos São independente e não deve ter acoplamento dos mesmos
        const parkingLot = await this.parkingLotRepository.getParkingLot(code);
        return parkingLot;
    }
}