export default class ParkingLot {

    private _occupiedSpaces: number = 0;

    constructor(private _code: string, private _capacity: number, private _openHour: number, private _closeHour:number){

    }

    public get code(){
        console.log('get')
        return this._code
    }

    public get occupiedSpaces(){
        console.log('occupiedSpaces')
        return this._occupiedSpaces
    }

    public set occupiedSpaces(num: number){
        console.log(num, 'occupiedSpaces')
        this._occupiedSpaces = num;
    }

    isOpen(date: Date) {
        const hour = date.getHours()
        console.log(hour,'hour')
        console.log(this._openHour,this._closeHour)
        console.log((hour >= this._openHour && hour <= this._closeHour))
        return (hour >= this._openHour && hour <= this._closeHour)
    }
}