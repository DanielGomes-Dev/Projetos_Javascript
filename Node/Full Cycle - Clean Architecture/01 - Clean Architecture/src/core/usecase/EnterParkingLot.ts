import ParkedCar from "../entity/ParkedCar"
import ParkingLotRepository from "../repository/ParkingLotRepository"

export default class EnterParkingLot {
    constructor(private parkingLotRepository: ParkingLotRepository) {}

    async execute(code: string,plate: string,date: Date) {
        const parkingLot=await this.parkingLotRepository.getParkingLot(code)
        if(parkingLot.isFull()) throw new Error('The Parking Lof is Full')
        if(!parkingLot.isOpen(date)) throw new Error("The Parking Lot is closed")
        const parkedCar=new ParkedCar(code,plate,date)
        await this.parkingLotRepository.saveParkedCar(parkedCar.code,parkedCar.plate,parkedCar.date)
        return parkingLot
    }
}