import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface LawsuitAttributes {
  id: string;
  cnjNumber: string;
  status: string;
  clientId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type LawsuitCreationAttributes = Optional<LawsuitAttributes, 'id' | 'status'>;

class Lawsuit extends Model<LawsuitAttributes, LawsuitCreationAttributes> implements LawsuitAttributes {
  declare id: string;
  declare cnjNumber: string;
  declare status: string;
  declare clientId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Lawsuit.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    cnjNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'cnj_number',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING',
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
    },
  },
  {
    sequelize,
    modelName: 'Lawsuit',
    tableName: 'lawsuits',
    underscored: true,
  }
);

export default Lawsuit;
