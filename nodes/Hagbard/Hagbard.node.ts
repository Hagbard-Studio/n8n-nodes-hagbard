import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { hagbardRequest } from './GenericFunctions';

export class Hagbard implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Hagbard',
		name: 'hagbard',
		icon: { light: 'file:hagbard.svg', dark: 'file:hagbard.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'New businesses before they open, from public records',
		defaults: { name: 'Hagbard' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'hagbardApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Find by Name',
						value: 'find',
						description: 'Find a business by name and city',
						action: 'Find a business by name',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get one business by ID',
						action: 'Get a business',
					},
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'List new businesses in your counties',
						action: 'Get many businesses',
					},
					{
						name: 'Unlock',
						value: 'unlock',
						description: 'Lifetime plans: unlock one business (uses one monthly unlock)',
						action: 'Unlock a business',
					},
				],
				default: 'getMany',
			},
			{
				displayName: 'Business ID',
				name: 'businessId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['get', 'unlock'] } },
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['find'] } },
			},
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['find'] } },
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { operation: ['getMany'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: { show: { operation: ['getMany'], returnAll: [false] } },
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { operation: ['getMany'] } },
				options: [
					{
						displayName: 'County Names or IDs',
						name: 'county',
						type: 'multiOptions',
						typeOptions: { loadOptionsMethod: 'getCounties' },
						default: [],
						description:
							'Only these counties. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'First Seen Since',
						name: 'since',
						type: 'dateTime',
						default: '',
						description: 'Only businesses first seen on or after this date',
					},
					{
						displayName: 'Stage',
						name: 'stage',
						type: 'multiOptions',
						options: [
							{ name: 'Building Permit', value: 'permit' },
							{ name: 'Opened', value: 'open' },
							{ name: 'Registered, Not Open Yet', value: 'registered' },
						],
						default: [],
					},
					{
						displayName: 'Type Names or IDs',
						name: 'type',
						type: 'multiOptions',
						typeOptions: { loadOptionsMethod: 'getTypes' },
						default: [],
						description:
							'Only these business types. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getCounties(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = await hagbardRequest.call(this, 'GET', '/counties');
				return ((res.data as IDataObject[]) ?? []).map((c) => ({
					name: `${c.name as string}, ${c.state as string}`,
					value: c.fips as string,
				}));
			},
			async getTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = await hagbardRequest.call(this, 'GET', '/types');
				return ((res.data as string[]) ?? []).map((t) => ({ name: t, value: t }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				if (operation === 'get' || operation === 'unlock') {
					const id = encodeURIComponent(this.getNodeParameter('businessId', i) as string);
					const res =
						operation === 'get'
							? await hagbardRequest.call(this, 'GET', `/businesses/${id}`)
							: await hagbardRequest.call(this, 'POST', `/businesses/${id}/unlock`);
					out.push({ json: res.data as IDataObject, pairedItem: { item: i } });
				} else if (operation === 'find') {
					const res = await hagbardRequest.call(this, 'GET', '/businesses/lookup', {
						name: this.getNodeParameter('name', i) as string,
						city: this.getNodeParameter('city', i) as string,
					});
					for (const hit of (res.data as IDataObject[]) ?? [])
						out.push({ json: { ...(hit.business as IDataObject), score: hit.score }, pairedItem: { item: i } });
				} else {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					const f = this.getNodeParameter('filters', i) as IDataObject;
					const qs: IDataObject = {};
					if ((f.county as string[] | undefined)?.length) qs.county = (f.county as string[]).join(',');
					if ((f.type as string[] | undefined)?.length) qs.type = (f.type as string[]).join(',');
					if ((f.stage as string[] | undefined)?.length) qs.stage = (f.stage as string[]).join(',');
					if (f.since) qs.since = new Date(f.since as string).toISOString();
					let got = 0;
					let cursor: string | null = null;
					do {
						const res: IDataObject = await hagbardRequest.call(this, 'GET', '/businesses', {
							...qs,
							limit: Math.min(100, limit - got),
							...(cursor ? { cursor } : {}),
						});
						for (const b of (res.data as IDataObject[]) ?? []) {
							out.push({ json: b, pairedItem: { item: i } });
							got++;
						}
						cursor = (res.next_cursor as string | null) ?? null;
					} while (cursor && got < limit);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
