import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface ClientAttributes {
  id: string;
  name: string;
  document: string;
  email: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ClientCreationAttributes = Optional<ClientAttributes, 'id' | 'email'>;

class Client extends Model<ClientAttributes, ClientCreationAttributes> implements ClientAttributes {
  declare id: string;
  declare name: string;
  declare document: string;
  declare email: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Client.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    document: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Client',
    tableName: 'clients',
    underscored: true,
  }
);

export default Client;
