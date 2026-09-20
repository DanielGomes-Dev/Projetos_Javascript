import ParkedCar from "../entity/ParkedCar"
import ParkingLotRepository from "../repository/ParkingLotRepository"

export default class EnterParkingLot {


    constructor(private parkingLotRepository: ParkingLotRepository){

    }

    async execute (code: string, plate: string, date: Date) { //Pode usar Dtos mas nao pegar um ParkedCar diretamente -> fazer o parkedCar Implementar o Dto
        const parkingLot = await this.parkingLotRepository.getParkingLot(code);
        if(!parkingLot.isOpen(date)) throw new Error('The park is closed')

        // useCases podem enxergar Entity porem entity não podem enchergar useCases
        const parkedCard = new ParkedCar(code, plate, date)
        await this.parkingLotRepository.saveParkedCar(parkedCard.code, parkedCard.plate, parkedCard.date)
        parkingLot.occupiedSpaces = parkingLot.occupiedSpaces + 1
        console.log(parkingLot.occupiedSpaces,'parkingLot.occupiedSpaces')
        return parkingLot;
    }
}