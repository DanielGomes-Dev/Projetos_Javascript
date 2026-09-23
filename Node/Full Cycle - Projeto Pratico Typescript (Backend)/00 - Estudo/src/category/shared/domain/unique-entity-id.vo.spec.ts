import InvalidUuidError from "../errors/invalid-uuid.error.ts";
import UniqueEntityId from "./unique-entity-id.vo.ts";
import { validate as uuidValidate } from "uuid";


function spyValidateMethod(){
    const validateSpy = jest.spyOn(UniqueEntityId.prototype as any, 'validate') // validate e um metodo privado (usar o as any)
    return validateSpy
}

describe('UniqueEntityId Unit Tests', () => {
    // afterEach(() => {
    //     jest.clearAllMocks();
    // });
    const validateSpy = spyValidateMethod()
    // beforeEach(() => {
    //     validateSpy.mockClear();
    // });

    // afterEach(() => {
    //     validateSpy.mockClear();
    // });


    it('should throw error when uuid is invalid', () => {
        expect(()=> new UniqueEntityId("Fake Id")).toThrow(new InvalidUuidError())
        expect(validateSpy).toHaveBeenCalled();
    });

    it('should accept a uuid passed in constructor', () => {
        const uuid = "d6a12be6-ebca-4d7f-8048-38a45f51c65c"
        const vo = new UniqueEntityId(uuid)
        expect(vo.id).toBe(uuid)
        expect(uuidValidate(vo.id)).toBeTruthy()
        expect(validateSpy).toHaveBeenCalledTimes(1);
    });

    it('should accept a uuid not passed in constructor', () => {
        const vo = new UniqueEntityId()
        expect(vo.id).toBeTruthy()
        expect(uuidValidate(vo.id)).toBeTruthy()
        expect(validateSpy).toHaveBeenCalledTimes(1);

    });
});