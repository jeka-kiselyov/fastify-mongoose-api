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
    models: Record<string, TFMASchema>;
    prefix?: string;
    setDefaults?: boolean;
    exposeVersionKey?: boolean;
    exposeModelName?: boolean|string;
    methods?: TFMAMethods[];
    checkAuth?: (request: any, reply: any) => boolean;
    schemas?: TFMASchemas[];
    schemaDirPath?: string;
};

export interface IAPI {}

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

export type TFMASchema = Partial<ajvMongooseSchema> & {
    summary: string;
    tags: Array<string>;
    params?: ajvSchema;
    query?: Omit<ajvSchema, 'properties'> & {
        properties: Partial<Record<keyof TFMAFilters, ajvSchema>>;
    };
    querystring?: Omit<ajvSchema, 'properties'> & {
        properties: Partial<Record<keyof TFMAFilters, ajvSchema>>;
    };
    body?: any;
    response?: {
        200?: ajvSchema;
        204?: ajvSchema;
        302?: ajvSchema;
        400?: ajvSchema;
        401?: ajvSchema;
        404?: ajvSchema;
        500?: ajvSchema;
    };
    apiValues?: (request: any, reply: any) => any;
};

export type TFMASchemas = Record<TFMASchemaVerbs, TFMASchema>;

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

type MongooseSchema = Record<string, any>;

type ajvMongooseSchema = {
    schema: MongooseSchema ;
};

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
