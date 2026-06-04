import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

export const createMongooseOptions = (): MongooseModuleOptions => {
  return {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cooperative_farming',
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    retryWrites: true,
    retryReads: true,
  };
};

export const MongooseConfigFactory = {
  createMongooseOptions: () => ({
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cooperative_farming',
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    retryWrites: true,
    retryReads: true,
  }),
};
