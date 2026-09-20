import ParkingLot from "../src/core/entity/ParkingLot"
import EnterParkingLot from "../src/core/usecase/EnterParkingLot"
import GetParkingLot from "../src/core/usecase/GetParkingLot"
import ParkingLotRepositoryMemory from "../src/infra/repository/ParkingLotRepositoryMemory"
import ParkingLotRepositorySQL from "../src/infra/repository/ParkingLotRepositorySQL"


test('should get parking lot',async () => {
    const parkingLotRepositoryMemory=new ParkingLotRepositoryMemory()
    const parkingLotRepositorySQL=new ParkingLotRepositorySQL()

    const getParkingLot=new GetParkingLot(parkingLotRepositoryMemory)
    const parkingLot=await getParkingLot.execute('shopping')
    expect(parkingLot.code).toBe('shopping')
})

test.skip('should enter parking lot',async () => {
    const parkingLotRepositoryMemory=new ParkingLotRepositoryMemory()
    const parkingLotRepositorySQL=new ParkingLotRepositorySQL()

    const enterParkingLot=new EnterParkingLot(parkingLotRepositoryMemory)
    const getParkingLot=new GetParkingLot(parkingLotRepositoryMemory)

    const parkingLotBeforeEnter=await getParkingLot.execute('shopping')
    expect(parkingLotBeforeEnter.occupiedSpaces).toBe(0)

    const parkingLot=await enterParkingLot.execute('shopping',"MMM-0001",new Date("2021-03-01T17:00:00.000Z"))

    const parkingLotAfterEnter=await getParkingLot.execute('shopping')
    expect(parkingLotAfterEnter.occupiedSpaces).toBe(1)

    expect(parkingLot.code).toBe('shopping')
})

test.skip('should be closed',async () => {
    const parkingLotRepositoryMemory=new ParkingLotRepositoryMemory()
    const parkingLotRepositorySQL=new ParkingLotRepositorySQL()

    const enterParkingLot=new EnterParkingLot(parkingLotRepositoryMemory)
    const getParkingLot=new GetParkingLot(parkingLotRepositoryMemory)

    const parkingLotBeforeEnter=await getParkingLot.execute('shopping')

    const parkingLot=await enterParkingLot.execute('shopping',"MMM-0001",new Date("2023-07-19T06:23:56.922Z"))


    expect(parkingLot.code).toBe('shopping')
})

test.skip('should be full',async () => {
    const parkingLotRepositoryMemory=new ParkingLotRepositoryMemory()
    const enterParkingLot=new EnterParkingLot(parkingLotRepositoryMemory)
    const getParkingLot=new GetParkingLot(parkingLotRepositoryMemory)

    const parkingLotBeforeEnter=await getParkingLot.execute('shopping')

    await enterParkingLot.execute('shopping',"MMM-0001",new Date("2023-07-19T17:10:56.922Z"))
    await enterParkingLot.execute('shopping',"MMM-0002",new Date("2023-07-19T17:10:56.922Z"))
    await enterParkingLot.execute('shopping',"MMM-0003",new Date("2023-07-19T17:10:56.922Z"))
    await enterParkingLot.execute('shopping',"MMM-0004",new Date("2023-07-19T17:10:56.922Z"))
    await enterParkingLot.execute('shopping',"MMM-0005",new Date("2023-07-19T17:10:56.922Z"))
    const parkingLot=await enterParkingLot.execute('shopping',"MMM-0006",new Date("2023-07-19T17:10:56.922Z"))


    expect(parkingLot.code).toBe('shopping')
})