import EnterParkingLot from "../src/core/usecase/EnterParkingLot"
import GetParkingLot from "../src/core/usecase/GetParkingLot"
import ParkingLotRepositoryMemory from "../src/infra/repository/ParkingLotRepositoryMemory"

test("Should enter Parking lot", async () => {
    const parkingLotRepository = new ParkingLotRepositoryMemory();
    const enterParkingLot = new EnterParkingLot(parkingLotRepository)
    const getParkingLot = new GetParkingLot(parkingLotRepository);

    const parkingLotBeforeEnter = await getParkingLot.execute('Shopping1')
 
    expect(parkingLotBeforeEnter.occupiedSpaces).toBe(0);

    const parkingLot = await enterParkingLot.execute('Shopping1','ABC-1234', new Date("2021-03-01T10:00:00"));
    const parkingLotAfterEnter = await getParkingLot.execute('Shopping1')
    expect(parkingLot.occupiedSpaces).toBe(1);
    expect(parkingLotAfterEnter.code).toBe('Shopping1')
})

// test("Should be closed", async () => {
//     const parkingLotRepository = new ParkingLotRepositoryMemory();
//     const enterParkingLot = new EnterParkingLot(parkingLotRepository)
//     const getParkingLot = new GetParkingLot(parkingLotRepository);

//     const parkingLotBeforeEnter = await getParkingLot.execute('Shopping1')
 
//     expect(parkingLotBeforeEnter.occupiedSpaces).toBe(0);

//     const parkingLot = await enterParkingLot.execute('Shopping1','ABC-1234', new Date("2021-03-01T23:00:00"));
    
//     // const parkingLotAfterEnter = await getParkingLot.execute('Shopping1')
 
//     // expect(parkingLotAfterEnter.occupiedSpaces).toBe(1);
//     // expect(parkingLot.code).toBe('Shopping1')
// })

test("Should be full", async () => {
    const parkingLotRepository = new ParkingLotRepositoryMemory();
    const enterParkingLot = new EnterParkingLot(parkingLotRepository)
    const getParkingLot = new GetParkingLot(parkingLotRepository);

    const parkingLotBeforeEnter = await getParkingLot.execute('Shopping1')
 
    expect(parkingLotBeforeEnter.occupiedSpaces).toBe(0);

    await enterParkingLot.execute('Shopping1','ABC-1234', new Date("2021-03-01T13:00:00"));
    await enterParkingLot.execute('Shopping1','ABC-1134', new Date("2021-03-01T13:00:00"));
    await enterParkingLot.execute('Shopping1','ABC-1134', new Date("2021-03-01T13:00:00"));
    await enterParkingLot.execute('Shopping1','ABC-1134', new Date("2021-03-01T13:00:00"));
    await enterParkingLot.execute('Shopping1','ABC-1134', new Date("2021-03-01T13:00:00"));
    const park = await enterParkingLot.execute('Shopping1','ABC-1134', new Date("2021-03-01T13:00:00"));

    console.log(park,enterParkingLot)
    // const parkingLotAfterEnter = await getParkingLot.execute('Shopping1')
 
    // expect(parkingLotAfterEnter.occupiedSpaces).toBe(1);
    // expect(parkingLot.code).toBe('Shopping1')
})