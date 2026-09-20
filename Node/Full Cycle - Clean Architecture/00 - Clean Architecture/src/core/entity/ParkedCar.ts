export default class ParkedCar {
    constructor(private _code: string, private _plate: string, private _date: Date){
        if(!/[A-Z]{3}-[0-9]{4}/.test(_plate)) throw new Error('Invalid Plate')

    }

    public get code(){
        console.log('get')
        return this._code
    }

    public get plate(){
        console.log('plate')
        return this._plate
    }

    public get date(){
        console.log('date')
        return this._date
    }
}