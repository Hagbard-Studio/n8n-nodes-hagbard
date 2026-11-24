import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { hagbardRequest } from '../Hagbard/GenericFunctions';

/**
 * Polls Hagbard for new businesses and stage changes in your counties. Hagbard updates once a day (around 11:00 UTC), so an
 * hourly poll is plenty. Each item has an id "<business id>:<stage>" and is emitted once. "Now Reachable" (entry.updated) fires when a
 * business gets a phone number, a website or a Google listing; the item has a "change" object and never carries the phone number.
 */
export class HagbardTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Hagbard Trigger',
		name: 'hagbardTrigger',
		icon: { light: 'file:hagbard.svg', dark: 'file:hagbard.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when Hagbard finds a new business, a stage change or a new phone/website in your counties',
		defaults: { name: 'Hagbard Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'hagbardApi', required: true }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'New Business or Stage Change', value: 'any' },
					{ name: 'New Business', value: 'entry.created' },
					{ name: 'Stage Change', value: 'entry.stage_changed' },
					{
						name: 'Now Reachable (Phone, Website or Google Found)',
						value: 'entry.updated',
						description: 'The item has a "change" object. A phone change says phone_available: true, never the number.',
					},
				],
				default: 'entry.created',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const state = this.getWorkflowStaticData('node') as { since?: string; seen?: string[] };
		const event = this.getNodeParameter('event') as string;
		const f = this.getNodeParameter('filters') as IDataObject;
		const counties = (f.county as string[] | undefined) ?? [];
		const types = (f.type as string[] | undefined) ?? [];
		const manual = this.getMode() === 'manual';

		const res = await hagbardRequest.call(this, 'GET', '/triggers/new-businesses', {
			limit: 100,
			...(state.since && !manual ? { since: state.since } : {}),
			// entry.updated only on request, so "any" keeps its old meaning (new business or stage change)
			...(event === 'entry.updated' ? { include: 'updated' } : {}),
		});
		const all = ((res.data as IDataObject[]) ?? []).filter((it) => {
			const b = it.business as IDataObject;
			return (
				(event === 'any' || it.event === event) &&
				(!counties.length || counties.includes(b.county_fips as string)) &&
				(!types.length || types.includes(b.business_type as string))
			);
		});
		if (manual) return all.length ? [[{ json: all[0] }]] : null;

		const seen = new Set(state.seen ?? []);
		const fresh = all.filter((it) => !seen.has(it.id as string));
		// newest event time and the ids at that time (the API returns items at or after "since")
		const newest = ((res.data as IDataObject[]) ?? []).map((it) => it.event_at as string).sort().at(-1);
		if (newest) {
			const atNewest = ((res.data as IDataObject[]) ?? []).filter((it) => it.event_at === newest).map((it) => it.id as string);
			state.seen = newest === state.since ? [...new Set([...(state.seen ?? []), ...atNewest])] : atNewest;
			state.since = newest;
		}
		if (!fresh.length) return null;
		return [fresh.reverse().map((it) => ({ json: it }))];
	}
}
