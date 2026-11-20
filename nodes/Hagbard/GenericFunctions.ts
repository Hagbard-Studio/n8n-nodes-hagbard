import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';

export const BASE_URL = 'https://app.hagbard.studio/api/v1';

export async function hagbardRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body?: IDataObject,
): Promise<IDataObject> {
	return (await this.helpers.httpRequestWithAuthentication.call(this, 'hagbardApi', {
		method,
		url: `${BASE_URL}${path}`,
		qs,
		body,
		json: true,
	})) as IDataObject;
}
