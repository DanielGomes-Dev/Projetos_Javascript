import UniqueEntityId from '../../shared/domain/unique-entity-id.vo.ts';

export type CategoryProperties = {
        name: string;
        description?: string;
        is_active?: boolean;
        created_at?: Date;
}


export class Category {

    public readonly id: UniqueEntityId;
    
    constructor(
        public readonly props: CategoryProperties, id?: UniqueEntityId
    ) {

        // Adicionar props a category
        this.id = id || new UniqueEntityId();
        this.props.name = props.name;
        this.props.description = props.description ?? "";
        this.props.is_active = props.is_active ?? true;
        this.props.created_at = props.created_at ?? new Date();

    }

    
    get name()  {
        return this.props.name;
    }

    
    get description() {
        return this.props.description;
    }

    private set description(value: string){
        this.props.description = value ?? "";
    }

    
    get is_active()  {
        return this.props.is_active;
    }

    private set is_active(value: boolean){
        this.props.is_active = value ?? true;
    }

    get created_at()  {
        return this.props.created_at;
    }

    private set created_at(value: Date){
        this.props.created_at = value ?? new Date();
    }


}


// const category = new Category({
//     name: "nome"
// })

// const category = new Category({
//         "name":'test', 
//         "description":"test232",
//         "is_active":true,
//         "created_at": new Date()
//     })


// category.props.name