export default class ParkingLot {
    constructor(public code: string,public capacity: number,public openHour: number,public closeHour: number,public occupiedSpaces: number) {}

    isOpen(date: Date) {
        const hour=date.getHours()
        console.log(hour,this.openHour,this.closeHour,date)
        return (hour>=this.openHour&&hour<=this.closeHour)
    }

    isFull() {
        return this.capacity===this.occupiedSpaces
    }
}