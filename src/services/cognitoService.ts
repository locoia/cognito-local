import { ResourceNotFoundError } from "../errors";
import { Logger } from "../log";
import { AppClient } from "./appClient";
import { Clock } from "./clock";
import { CreateDataStore, DataStore } from "./dataStore";
import {
  CreateUserPoolService,
  UserPool,
  UserPoolService,
} from "./userPoolService";

export interface CognitoService {
  getAppClient(clientId: string): Promise<AppClient | null>;
  getUserPool(userPoolId: string): Promise<UserPoolService>;
  getUserPoolForClientId(clientId: string): Promise<UserPoolService>;
}

type UserPoolDefaultConfig = Omit<UserPool, "Id">;

export class CognitoServiceImpl implements CognitoService {
  private readonly clients: DataStore;
  private readonly clock: Clock;
  private readonly userPoolDefaultConfig: UserPoolDefaultConfig;
  private readonly createDataStore: CreateDataStore;
  private readonly createUserPoolClient: CreateUserPoolService;
  private readonly logger: Logger;

  public static async create(
    userPoolDefaultConfig: UserPool,
    clock: Clock,
    createDataStore: CreateDataStore,
    createUserPoolClient: CreateUserPoolService,
    logger: Logger
  ): Promise<CognitoService> {
    const clients = await createDataStore("clients", { Clients: {} });

    return new CognitoServiceImpl(
      clients,
      clock,
      userPoolDefaultConfig,
      createDataStore,
      createUserPoolClient,
      logger
    );
  }

  public constructor(
    clients: DataStore,
    clock: Clock,
    userPoolDefaultConfig: UserPoolDefaultConfig,
    createDataStore: CreateDataStore,
    createUserPoolClient: CreateUserPoolService,
    logger: Logger
  ) {
    this.clients = clients;
    this.clock = clock;
    this.userPoolDefaultConfig = userPoolDefaultConfig;
    this.createDataStore = createDataStore;
    this.createUserPoolClient = createUserPoolClient;
    this.logger = logger;
  }

  public async getUserPool(userPoolId: string): Promise<UserPoolService> {
    return this.createUserPoolClient(
      this.clients,
      this.clock,
      this.createDataStore,
      { ...this.userPoolDefaultConfig, Id: userPoolId },
      this.logger
    );
  }

  public async getUserPoolForClientId(
    clientId: string
  ): Promise<UserPoolService> {
    const appClient = await this.getAppClient(clientId);
    if (!appClient) {
      throw new ResourceNotFoundError();
    }

    return this.createUserPoolClient(
      this.clients,
      this.clock,
      this.createDataStore,
      { ...this.userPoolDefaultConfig, Id: appClient.UserPoolId },
      this.logger
    );
  }

  public async getAppClient(clientId: string): Promise<AppClient | null> {
    return this.clients.get(["Clients", clientId]);
  }
}