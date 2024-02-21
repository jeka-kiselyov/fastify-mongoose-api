import { SchemaTypeOptions as MongooseSchemaTypeOptions, Model as MongooseModel } from 'mongoose';
import type { TFMPModel } from 'fastify-mongoose-plugin';
import type API from './libs/API.js';
import type DefaultModelMethods from './libs/DefaultModelMethods.js';
import type {
    FastifyInstance,
    FastifyPluginAsync,
    FastifyPluginOptions
} from 'fastify';

declare module 'fastify' {
    export interface FastifyInstance {
        mongooseAPI: API;
    }
}

export type TFMAPluginAsync<T extends TFMAPluginOptions> =
    FastifyPluginAsync<T> & {
        DefaultModelMethods?: typeof DefaultModelMethods;
    };

export type TFMAMethods = 'list' | 'get' | 'post' | 'patch' | 'put' | 'delete';


export type TFMAPluginOptions = FastifyPluginOptions & {
    models: Record<string, TFMAModel>;
    prefix?: string;
    setDefaults?: boolean;
    exposeVersionKey?: boolean;
    exposeModelName?: boolean | string;
    methods?: TFMAMethods[];
    checkAuth?: (request: any, reply: any) => boolean;
    schemas?: TFMASchemas[];
    schemaDirPath?: string;
};

// TODO: restrict to only apirouter parameters
export type TFMAApiRouterOptions = TFMAApiOptions & {
    model: TFMAModel;
    schema: TFMASchemas;
}

export interface IAPI { }

export type TFMAApiOptions = TFMAPluginOptions & {
    fastify: FastifyInstance;
};

export type TFMAFiltersPagination = {
    offset?: number;
    skip?: number;
    limit?: number;
    page?: number;
    window?: number;
};

export type TFMAFiletrsSort = {
    sort?: string;
};

export type TFMAFiltersProjection = {
    projection?: string;
};

export type TFMAFiltersPopulate = {
    populate?: string;
};

export type TFMAFiltersSearch = {
    where?: string;
    search?: string;
    match?: string;
    filter?: string;
};

export type TFMAFilters = TFMAFiltersPagination &
    TFMAFiletrsSort &
    TFMAFiltersProjection &
    TFMAFiltersSearch &
    TFMAFiltersPopulate;

export type TFMASchemaVerbs =
    | 'routeGet'
    | 'routePost'
    | 'routePut'
    | 'routeDelete'
    | 'routePatch'
    | 'routeList';

export type TFMASchema = TFMAModelMethods & {
    summary: string;
    tags: Array<string>;
    params?: ajvSchema;
    query?: Omit<ajvSchema, 'properties'> & {
        properties: Partial<Record<keyof TFMAFilters, ajvSchema>>;
    };
    querystring?: Omit<ajvSchema, 'properties'> & {
        properties: Partial<Record<keyof TFMAFilters, ajvSchema>>;
    };
    body?: ajvSchema;
    response?: {
        200?: ajvSchema;
        204?: ajvSchema;
        302?: ajvSchema;
        400?: ajvSchema;
        401?: ajvSchema;
        404?: ajvSchema;
        500?: ajvSchema;
    };
};

/// Model

export type TFMAModelMethodsKeys = 'apiValues' | 'apiPost' | 'apiPut' | 'apiDelete' | 'apiSubRoutes';

export type TFMAModelMethods<T=any> = {
    apiValues?: (request: any) => Promise<T> //! Not sure
    apiPost?: (data: T) => Promise<T>;
    apiPut?: (data: T) => Promise<T>;
    apiDelete?: () => Promise<void>;
    apiSubRoutes?: () => any; // TODO: define return type
}

export type TFMAModel<T=any> = 
    Omit<Partial<MongooseModel<T>>, 'modelName'> &
    Required<Pick<MongooseModel<T>, 'modelName'>> 
    & TFMAModelMethods &
    { __api?: API;}

// define a schema element for db and route element
// it's an item of the schemas config option
// TODO: maybe find a better name because is ONE element
export type TFMASchemas =
    Record<TFMASchemaVerbs, TFMASchema>     // routeGet/Post/... definition for ajvSchema routes
    & TFMPModel                             // fastify-mongoose-plugin model definition. See: https://github.com/EmilianoBruni/fastify-mongoose-plugin/?tab=readme-ov-file#options .models
    & {
        ref: ajvSchema | ajvSchema[];       // ajvSchemas to register in fastify
    };

/// Mongoose elements

// describe a mongoose schema for the model
// see: https://www.geeksforgeeks.org/mongoose-schematype-options/
export type MongooseSchema<T = any> = Record<string, MongooseSchemaTypeOptions<T>>;

/// AJV elements

// describe an ajv schema for validation and serialization in fastify routes
// https://ajv.js.org/json-schema.html#openapi-support
// used in TFMASchemas.ref[] and in routeGet.body, .params, .response.200
export type ajvSchema = ajvProperties & {
    type: ajvType;
    items?: ajvSchema[];
    $ref?: string;
    description?: string;
    required?: Array<string>;
    enum?: Array<string>;
    default?: any;
    additionalProperties?: boolean;
    oneOf?: Array<ajvSchema>;
    anyOf?: Array<ajvSchema>;
    allOf?: Array<ajvSchema>;
    not?: ajvSchema;
    title?: string;
    format?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    multipleOf?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    contains?: ajvSchema;
    examples?: Array<any>;
    const?: any;
    readOnly?: boolean;
    writeOnly?: boolean;
    discriminator?: string;
    xml?: any;
    externalDocs?: any;
    deprecated?: boolean;
    if?: ajvSchema;
    then?: ajvSchema;
    else?: ajvSchema;
    contentEncoding?: string;
    contentMediaType?: string;
    contentSchema?: ajvSchema;
    //[key: string]: any;
    example?: string | number | boolean | object | Array<any> | null;
    // not sure $id goes here
    $id?: string;
};

export type ajvType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'object'
    | 'array'
    | 'null'
    | 'timestamp';

export type ajvProperty = {
    [key: string]: ajvSchema | ajvProperties;
};

export type ajvProperties = {
    properties?: ajvProperty;
};

