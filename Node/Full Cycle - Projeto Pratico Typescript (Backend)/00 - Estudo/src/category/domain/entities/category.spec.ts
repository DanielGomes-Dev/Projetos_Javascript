import { Category, type CategoryProperties } from "./category.ts";
import { omit } from 'lodash'
import UniqueEntityId from "../../shared/domain/unique-entity-id.vo.ts";


type CategoryDate = {props: CategoryProperties, id?: UniqueEntityId}
const datas : CategoryDate[] = [
    {props: {name: "movie"}},
    {props: {name: "movie"}, id: null},
    {props: {name: "movie"}, id: undefined},
    {props: {name: "movie"}, id: new UniqueEntityId("d6a12be6-ebca-4d7f-8048-38a45f51c65c")},

]

describe('Category Unit Tests', () => {

    describe('constructor', () => {
        test('should send all parameters', () => {
            let created_at = new Date()
            const category = new Category({
                name: 'some name',
                description: "some description",
                is_active: false,
                created_at: created_at

            });

            expect(category.props).toStrictEqual({
                name: 'some name',
                description: 'some description',
                is_active: false,
                created_at: created_at

            });

        });


        test('should send only name', () => {

            const category = new Category({
                "name": 'some name',
            });
            const cat_props = omit(category.props, 'created_at')

            expect(cat_props).toStrictEqual({
                name: 'some name',
                description: '',
                is_active: true,
            });

            expect(category.props.created_at).toBeInstanceOf(Date);

        });

        test('should send name and description', () => {
            const category = new Category({
                name: 'some name',
                description: "other description",
            });
            const cat_props = omit(category.props, 'created_at')
            
            expect(cat_props).toStrictEqual({
                name: 'some name',
                description: "other description",

                is_active: true,
            })
        });

        test('should send name and is_active', () => {
                const category = new Category({
                    name: 'some name',
                    is_active: false,

                });
                const cat_props = omit(category.props, 'created_at')
                
                expect(cat_props).toStrictEqual({
                    name: 'some name',
                    description: '',
                    is_active: false,
                })
        });

        test('should have id field', () => {


            for (const data of datas) {
                const category = new Category(data.props, data.id);
                expect(category.id).toBeTruthy();
                expect(category.id).not.toBeNull();
                expect(category.id).not.toBeUndefined();  
                data?.id && expect(category.id).toBe(data.id);
                // expect(uuidValidate(category.id.id)).toBeTruthy();
                expect(category.id).toBeInstanceOf(UniqueEntityId)

            }

            
        });
    });

    describe('getters and setters', () => {
        const date_now = new Date()
        const category = new Category({
            name: "Movie",
            description: "Some Description",
            is_active: false,
            created_at: date_now,
        })

        test('should get name', () => {
            expect(category.name).toBe('Movie');
        });

        test('should get description', () => {
            expect(category.description).toBe('Some Description');
        });

        test('should get is_active', () => {
            expect(category.is_active).toBe(false);
        });

        test('should get created_at', () => {
            expect(category.created_at).toBe(date_now);
        });


        test('should set description', () => {
            category["description"] = "New description";
            expect(category.description).toBe("New description");

            category["description"] = undefined;
            expect(category.description).toBe("");

        });

        test('should set is_active', () => {
            category["is_active"] = true;
            expect(category.is_active).toBeTruthy();

            category["is_active"] = false;
            expect(category.is_active).toBeFalsy();

            
            category["is_active"] = undefined;
            expect(category.is_active).toBeTruthy();
        });

        
        test('should set created_at', () => {
            const date_now = new Date();
            category["created_at"] = date_now;
            expect(category.created_at).toBe(date_now);

            category["created_at"] = undefined;
            expect(category.created_at).toBeInstanceOf(Date);

        });

    });
});