export default class ParkedCar {
    constructor(public code: string, public plate: string, public date: Date){
        if(!/[A-Z]{3}-[0-9]{4}/.test(plate)) throw new Error('Invalid Plate')
    }
}