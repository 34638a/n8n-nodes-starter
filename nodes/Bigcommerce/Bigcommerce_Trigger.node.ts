// eslint-disable-next-line n8n-nodes-base/node-filename-against-convention
import {
	IDataObject,
	IHookFunctions,
	type IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeProperties,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import querystring from 'querystring';

const createGlobalProperties = (
	events: Record<string, Record<string, string>>,
): INodeProperties[] => {

	const props: INodeProperties[] = Object.entries(events).map(([event, options]) => {
		return {
			displayName: `Global: Listen For ${event
				.split('-')
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')}`,
			name: `listenFor_global-${event}`,
			type: 'multiOptions',
			description: `<a href='https://developer.bigcommerce.com/docs/integrations/webhooks/events#${event}' target='_blank'>Documentation Link</a>`,
			default: [],
			options: Object.entries(options).map(([name, description]) => {
				return {
					name: name,
					value: name,
					description: description,
				} as INodePropertyOptions;
			}),
			displayOptions: {
				show: {
					setStoreChannel: [-1],
				},
			},
		};
	});

	return [
		{
			displayName: 'Global Webhooks',
			name: '__global__',
			type: 'notice',
			hint: '',
			default: '',
			displayOptions: {
				show: {
					setStoreChannel: [-1],
				},
			},
		},
		...props
	];
};

const createChannelProperties = (
	events: Record<string, Record<string, string>>,
): INodeProperties[] => {
	const props: INodeProperties[] = Object.entries(events).map(([event, options]) => {
		return {
			displayName: `Channel: Listen For ${event
				.split('-')
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')}`,
			name: `listenFor_channel-${event}`,
			type: 'multiOptions',
			description: `<a href='https://developer.bigcommerce.com/docs/integrations/webhooks/events/channels#${event}' target='_blank'>Documentation Link</a>`,
			default: [],
			options: Object.entries(options).map(([name, description]) => {
				return {
					name: name,
					value: name,
					description: description,
				} as INodePropertyOptions;
			}),
			displayOptions: {
				hide: {
					setStoreChannel: [-1],
				},
			},
		};
	});
	return [
		{
			displayName: 'Subscribed Channel Only Webhooks',
			name: '__channel__',
			type: 'notice',
			default: '',
			hint: 'These webhooks are only available for subscribed channels. If you have not subscribed to any channels, these webhooks will not be available.',
			displayOptions: {
				hide: {
					setStoreChannel: [-1],
				},
			},
		},
		...props
	]
};

export class Bigcommerce_Trigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Webhook: Bigcommerce API Trigger',
		icon: 'file:bigcommerce-logomark-whitebg.svg',
		name: 'bigcommerceTriggerNodeTrigger',
		group: ['trigger'],
		version: 1,
		description: 'Receive a Alert from the Bigcommerce API via Webhook',
		defaults: {
			name: 'Webhook: Bigcommerce API Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'bigcommerceApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'default',
			},
		],
		properties: [
			{
				displayName:
					'This node is used to receive webhooks from BigCommerce. It will automatically create and manage webhooks for the selected events. Ensure that your BigCommerce store is configured to allow webhooks.',
				type: 'notice',
				name: 'notice',
				default: '',
			},
			{
				displayName: 'Choose Channel By Name or ID',
				name: 'setStoreChannel',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				hint: 'Requires BigCommerce API credentials with permissions [ <b>store_channel_listings_read_only, store_channel_settings_read_only, store_sites_read_only</b> ] to fetch the list of channels.',
				// eslint-disable-next-line
				default: -1,
				typeOptions: {
					loadOptionsMethod: 'getChannels',
				},
			},
			...createGlobalProperties({
				brands: {
					'store/brand/metafield/*': 'Fires for all store/brand/metafield events',
					'store/brand/metafield/created': 'Fires when a new brand metafield is created',
					'store/brand/metafield/updated': 'Fires when a brand metafield is modified',
					'store/brand/metafield/deleted': 'Fires when a brand metafield is deleted',
				},
				carts: {
					'store/cart/*':
						'Fires for all store/cart events. Also fires for store/cart/lineItem events.',
					'store/cart/created':
						'Fires when a new cart is created, either when a storefront shopper adding their first item to the cart, or when a new cart is created by API. If it is from the storefront, then it fires when the first product is added to a new session; the cart did not exist before. For the API it means a POST to /carts, both REST Management and REST Storefront. The store/cart/updated webhook also fires.',
					'store/cart/updated':
						'Fires when a cart is modified through the changes in its line items. The payload includes the ID of the cart being updated. Qualifying events include the following: - A new item is added to a cart - An existing item’s quantity is updated - An existing item is deleted - A cart is created - the first product being added to an empty cart triggers an update - The email is changed during guest checkout - The shopper or session signs into a customer account after creating a cart - email is inherited from customer account email - The shopper enters an email address during guest checkout  - The shopper changes their email address during guest checkout',
					'store/cart/deleted':
						'Fires when a cart is deleted. This occurs either when all items have been removed from a cart and it is auto-deleted, or when the cart is explicitly removed by a DELETE request to an API. This ends the lifecycle of the cart. The store/cart/updated webhook also fires when the last item is removed.',
					'store/cart/couponApplied':
						'Fires when a new coupon code is applied to a cart. The payload includes the ID of the coupon code.',
					'store/cart/abandoned':
						'Fires when a cart is abandoned. A cart is considered abandoned when no changes have been made for at least one hour after the last modified property. This webhook is available for all store plans, regardless of whether the Abandoned Cart Saver feature is enabled.',
					'store/cart/converted':
						'Fires when a cart is converted into an order, which is typically after the payment step of checkout on the storefront. At this point, the cart is no longer accessible and has been deleted. This hook returns both the cart ID and order ID for correlation purposes.',
					'store/cart/metafield/created': 'Fires when a new cart metafield is created.',
					'store/cart/metafield/deleted':
						'Fires when a cart metafield is deleted. This occurs either when all items have been removed from a cart and it is auto-deleted, or when the cart is explicitly removed by a DELETE request to an API. This ends the lifecycle of the cart. The  store/cart/updated webhook also fires when the last item is removed.',
					'store/cart/metafield/updated':
						'Fires when a cart metafield is modified through the changes in its line items.',
				},
				'carts-line-items': {
					'store/cart/lineItem/*':
						'Subscribe to all cart line item events. Fires when a change occurs to line items in the cart. This can be when items are added to a cart, removed or updated.(Ex. change to quantity, product options or price).',
					'store/cart/lineItem/created': 'Fires when a new item is added to the cart.',
					'store/cart/lineItem/updated':
						'Fires when an item’s quantity has changed or the product options change.',
					'store/cart/lineItem/deleted': 'Fires when an item is deleted from the cart.',
				},
				categories: {
					'store/category/*': 'Fires for all store/category events.',
					'store/category/created': 'Fires when a category is created.',
					'store/category/updated': 'Fires when a category is updated.',
					'store/category/deleted': 'Fires when a category is deleted.',
					'store/category/metafield/created': 'Fires when a category metafield is created.',
					'store/category/metafield/deleted': 'Fires when a category metfield is deleted.',
					'store/category/metafield/updated': 'Fires when a category metafield is updated.',
				},
				customers: {
					'store/customer/*': 'Fires for all store/customer events.',
					'store/customer/created': 'Fires when a new customer is created.',
					'store/customer/updated':
						'Fires when a customer is updated. It does not currently track changes to the customer address. Tracks changes to customer attributes only if you make the changes through the control panel. This change triggers the same event type and payload as updating a customer; the payload does not include customer attributes.',
					'store/customer/deleted': 'Fires when a customer is deleted.',
					'store/customer/address/*': 'Fires for all store/customer/address events.',
					'store/customer/address/created': 'Fires when a customer address is created.',
					'store/customer/address/updated': 'Fires when a customer address is updated.',
					'store/customer/address/deleted': 'Fires when a customer address is deleted.',
					'store/customer/payment/instrument/default/updated':
						'Fires when a customer default payment instrument is updated.',
				},
				inventory: {
					'store/inventory/location/metafield/*':
						'Fires for all store/inventory/location/metafields events.',
					'store/inventory/location/metafield/created':
						'Fires when a new inventory location metafield is created.',
					'store/inventory/location/metafield/deleted':
						'Fires when an inventory location metafield is deleted.',
					'store/inventory/location/metafield/updated':
						'Fires when an already created inventory location metafield is updated. Any change to an existing inventory location metafield fires this webhook.',
				},
				metafields: {
					'store/metafield/*': 'Fires for all store/metafields events.',
					'store/metafield/created': 'Fires when a new metafield on any object is created.',
					'store/metafield/updated':
						'Fires when an already created metafield is updated. Any change to an existing metafield on any object fires this webhook, including inventory, carts, brands, categories, channels, orders, ShipperHQ, etc.',
					'store/metafield/deleted': 'Fires when a metafield is deleted.',
				},
				modifiers: {
					'store/modifier/updated':
						'Only fires when you edit attributes for a local or shared modifier in a context of a channel and locale. For information on updating overrides, see the International Enhancements for Multi-Storefront overview.',
				},
				options: {
					'store/option/updated':
						'Fires when you customize display name and values for a local or shared variant option in a context of a channel and locale. For information on updating overrides, see the International Enhancements for Multi-Storefront overview.',
				},
				orders: {
					'store/order/*': 'Fires for all store/order events.',
					'store/order/created':
						'Fires when an order is created from the storefront, using the control panel, an app, or the API. It also fires for incomplete orders, including failed payment and payment not processed orders.',
					'store/order/updated':
						'Fires when an already created order is updated. Any change to an existing order fires this webhook. Updates can include changing the status, updating a coupon, or changing an address.',
					'store/order/archived': 'Fires when an order is archived.',
					'store/order/statusUpdated':
						'Fires only if the order status has changed, such as Pending to Awaiting Payment.',
					'store/order/message/created':
						'Fires if order message is created by a customer or in the control panel.',
					'store/order/refund/created': 'Fires if a refund has been submitted against an order.',
					'store/order/transaction/created': 'Fires when a transaction record is created.',
					'store/order/transaction/updated': 'Fires when a transaction record is updated.',
					'store/order/metafield/created':
						'Fires if an order metafield is created using the control panel, an app, or the API.',
					'store/order/metafield/updated':
						'Fires when an existing order metafield is updated. Any change to an existing order metafield fires this webhook.',
					'store/order/metafield/deleted': 'Fires when an order metafield is deleted.',
				},
				'price-lists': {
					'store/priceList/created': 'Fires when a price list is created.',
					'store/priceList/updated/': 'Fires when a price list is updated.',
					'store/priceList/activated/': 'Fires when a price list is activated.',
					'store/priceList/deactivated/': 'Fires when a price list is deactivated.',
					'store/priceList/deleted/': 'Fires when a price list is deleted.',
				},
				'price-list-records': {
					'store/priceList/record/created/': 'Fires when a price list record is created.',
					'store/priceList/record/updated/':
						'Fires when an existing specific price list record is updated by variant and currency.',
					'store/priceList/record/deleted/': 'Fires when a price list record is deleted.',
				},
				'price-list-assignments': {
					'store/priceList/assignment/updated':
						'Fires when a price list assignment is assigned, reassigned, or unassigned.',
					'store/priceList/assignment/deleted': 'Fires when a price list assignment is deleted.',
				},
				products: {
					'store/product/*': 'Fires for all store/product events.',
					'store/product/deleted': 'Fires when a product is deleted.',
					'store/product/created': 'Fires when a new product is created.',
					'store/product/updated':
						'Fires when you edit product attributes globally or for a channel locale as an override. For a full list of product fields that trigger an updated event, see the product updated events that follow.The properties and context fields are present for only updates to overrides, not the global store. For information on updating overrides, see the International Enhancements for Multi-Storefront overview.',
					'store/product/inventory/updated':
						"Fires when inventory levels change for a base product. For products without variants, the webhook fires regardless of how you track inventory. For products with variants, the webhook only fires when the product's inventory properties are configured to track by product and the product-level inventory changes. Inventory updates made in the control panel and by API trigger the webhook. This includes changes made by apps. In the control panel, you can bulk import inventory updates or make inventory updates to single products on the Products > View page.",
					'store/product/inventory/order/updated':
						"Fires when base product inventory levels change in response to the order-related events configured in Inventory settings. For example, stock levels can change when you either place or complete/ship an order. Stock levels can also change when an order status changes to cancelled or refunded, but not partially refunded. Global settings apply when inventory changes through a manual order (opens in a new tab). The settings for a channel apply when inventory changes through an order in a channel.The webhook always fires for products without variants. For products with variants, the webhook only fires when you configure the product's inventory properties to track by product.",
					'store/product/metafield/*': 'Fires for all store/product/metafield events.',
					'store/product/metafield/created': 'Fires when a new product metafield is created.',
					'store/product/metafield/updated': 'Fires when product metafield details are edited.',
					'store/product/metafield/deleted': 'Fires when a product metafield is deleted.',
					'store/product/variant/metafield/*': 'Fires for all store/variant/metafield events.',
					'store/product/variant/metafield/created':
						'Fires when a new product variant metafield is created.',
					'store/product/variant/metafield/updated':
						'Fires when product variant metafield details are edited.',
					'store/product/variant/metafield/deleted':
						'Fires when a product variant metafield is deleted.',
				},
				shipments: {
					'store/shipment/*': 'Fires for all store/shipment events.',
					'store/shipment/created': 'Fires when a shipment is created.',
					'store/shipment/updated': 'Fires when a shipment is updated.',
					'store/shipment/deleted': 'Fires when a shipment is deleted.',
				},
				skus: {
					'store/sku/*': 'Fires for all store/sku events.',
					'store/sku/created': 'Fires when a new SKU is created.',
					'store/sku/updated': 'Fires when a SKU is updated.',
					'store/sku/deleted': 'Fires when a SKU is deleted.',
					'store/sku/inventory/updated':
						"Fires when inventory levels change for a variant. This webhook does not fire for products without variants. For products with variants, the webhook only fires when the product's inventory properties are configured to track by variant and the variant-level inventory changes. Inventory updates made in the control panel and by API trigger the webhook. This includes changes made by apps. In the control panel, you can bulk import inventory updates or make inventory updates to single products on the Products > View page.",
					'store/sku/inventory/order/updated':
						"Fires when variant inventory levels change in response to the order-related events configured in Inventory settings. For example, stock levels can change when you either place or complete/ship an order. Stock levels can also change when an order status changes to cancelled or refunded, but not partially refunded. Global settings apply when inventory changes through a manual order (opens in a new tab). Settings for a channel apply when inventory changes through an order in a channel.The webhook does not fire for products without variants. For products with variants, the webhook only fires when you configure the product's inventory properties to track by variant.",
				},
				stores: {
					'store/app/uninstalled':
						'Fires when a client store is cancelled and uninstalled from the platform.',
					'store/information/updated':
						'Fires when changes are made to store settings. For a full list of fields that can trigger this event, consult the following section on store information updated events.',
				},
				subscribers: {
					'store/subscriber/*': 'Fires for all store/subscriber events.',
					'store/subscriber/created': 'Fires when a subscriber is created.',
					'store/subscriber/updated': 'Fires when a subscriber is updated.',
					'store/subscriber/deleted': 'Fires when a subscriber is deleted.',
				},
				'channel-events': {
					'store/channel/*': 'Subscribes to all store/channel events',
					'store/channel/created':
						'Fires when a channel is created using the control panel or the API. The corresponding endpoint is Create a channel.',
					'store/channel/updated':
						'Fires when a channel is updated using the control panel or the API. The corresponding endpoint is Update a channel.',
				},
				'delivery-exception-hooks': {
					'store/hook/deliveryException':
						'Once configured by the API client, this hook fires when the destination has issues responding to regular hooks. The system will send deliveryException hook to a different destination and provide information regarding unsuccessful webhook delivery. There can only be one deliveryException hook per storeId/clientId. The destination must be different from all other hook destinations.',
				},
			}),
			...createChannelProperties({
				"carts": {
					'store/channel/{channel_id}/cart/*':
						'Fires on all cart changes associated with the specified channel.',
					'store/channel/{channel_id}/cart/created':
						'Fires on creation of a new cart associated with the specified channel. The corresponding endpoint is Create a cart.',
					'store/channel/{channel_id}/cart/updated':
						'Fires on update of a cart associated with the specified channel.',
					'store/channel/{channel_id}/cart/deleted':
						'Fires on deletion of a cart associated with the specified channel. The corresponding endpoint is Delete a cart.',
					'store/channel/{channel_id}/cart/couponApplied':
						'Fires when a new coupon code associated with the specified channel is applied to a cart.',
					'store/channel/{channel_id}/cart/abandoned':
						'Fires when a cart associated with the specified channel is abandoned.',
					'store/channel/{channel_id}/cart/converted':
						'Fires when a cart associated with the specified channel is converted into an order.',
				},
				"cart-line-items": {
					"store/channel/{channel_id}/cart/lineItem/*": "Fires on all cart line item changes associated with the specified channel.",
					"store/channel/{channel_id}/cart/lineItem/created": "Fires when a new item is added to a cart associated with the specified channel. The corresponding endpoint is Add cart line items.",
					"store/channel/{channel_id}/cart/lineItem/updated": "Fires when an item's quantity or product options change in a cart associated with the specified channel. The corresponding endpoint is Update Cart Line Item.",
					"store/channel/{channel_id}/cart/lineItem/deleted": "Fires when items are deleted from any cart associated with the specified channel. The corresponding endpoint is Delete cart line item."
				},
				"categories": {
					"store/channel/{channel_id}/category/*": "Fires when subscribed to all category events for categories associated with the specified channel.",
					"store/channel/{channel_id}/category/created": "Fires on creation of a new category in the category tree that is assigned to the specified channel. The corresponding endpoint is Create categories.",
					"store/channel/{channel_id}/category/updated": "Fires on update of a category within the category tree that is assigned to the specified channel. The corresponding endpoint is Update categories.",
					"store/channel/{channel_id}/category/deleted": "Fires when a category is removed from the category tree that is assigned to the specified channel. The corresponding endpoint is Delete categories."
				},
				"category-trees": {
					"store/channel/{channel_id}/categoryTree/updated": "Fires when the specified channel's category tree is updated, created, or deleted. The corresponding endpoint is Upsert category trees or Delete category trees."
				},
				"customers": {
					"store/customer/channel/login/access/updated": "Fires on update of any customer's login access. The corresponding endpoint is Update a customer."
				},
				emails: {
					"store/channel/{channel_id}/settings/emailStatus/updated": "Fires when an email status is updated per a specified channel. The corresponding endpoint is Update transactional email settings.",
					"store/channel/{channel_id}/settings/emailStatus/deleted": "Fires when an email status was deleted per a specified channel. The corresponding endpoint is Update transactional email settings.",
					"store/channel/{channel_id}/email/templates/updated": "Fires when an email template is updated per a specified channel. The corresponding endpoint is Update a template.",
					"store/channel/{channel_id}/email/templates/deleted": "Fires when an email template was deleted per a specified channel. The corresponding endpoint is Delete email template override."
				},
				"metafields": {
					"store/channel/metafield/created/": "Fires when a channel metafield is created on any channel. The corresponding endpoint is Create a channel metafield.",
					"store/channel/metafield/updated": "Fires when any channel metafield is updated. The corresponding endpoint is Update a channel metafield.",
					"store/channel/metafield/deleted": "Fires when any channel metafield is deleted. The corresponding endpoint is Delete a channel metafield."
				},
				"notifications": {
					"store/channel/{channel_id}/notifications/abandonedCart/updated": "Fires when an abandoned cart notification is updated in the specified channel. The corresponding endpoint is Update channel abandoned cart settings.",
					"store/channel/{channel_id}/notifications/inventory/updated": "Fires when an inventory notification is updated in the specified channel. The corresponding endpoint is Update inventory notifications settings."
				},
				"orders": {
					"store/channel/{channel_id}/order/*": "Fires on all order events associated with the specified channel.",
					"store/channel/{channel_id}/order/created": "Fires when an order associated with the specified channel is created. The corresponding endpoint is Create an order.",
					"store/channel/{channel_id}/order/updated": "Fires when an order associated with the specified channel is updated. The corresponding endpoint is Update an order.",
					"store/channel/{channel_id}/order/archived": "Fires when an order associated with the specified channel is archived. The corresponding endpoint is Archive an order.",
					"store/channel/{channel_id}/order/statusUpdated": "Fires when the status of an order associated with the specified channel is updated.",
					"store/channel/{channel_id}/order/message/created": "Fires when an order message for an order associated with the specified channel is created using the control panel or the API",
					"store/channel/{channel_id}/order/refund/created": "Fires when a refund is created for all or part of an order associated with the specified channel"
				},
				"pages": {
					"store/channel/{channel_id}/page/created": "Fires on creation of a page associated with the specified channel. The corresponding endpoint is Create pages.",
					"store/channel/{channel_id}/page/updated": "Fires on update of a page associated with the specified channel. The corresponding endpoint is Update pages."
				},
				"price-list-assignments": {
					"store/priceList/assignment/updated": "Fires when a price list assignment is assigned, reassigned, or unassigned. The corresponding endpoint is Create price list assignments."
				},
				"product-assignments": {
					"store/channel/{channel_id}/product/assigned": "Fires when a product is assigned to the specified channel. The corresponding endpoint is Create product channel assignments.",
					"store/channel/{channel_id}/product/unassigned": "Fires when a product is removed from the specified channel. The corresponding endpoint is Delete product channel assignments.",
					"store/channel/{channel_id}/category/product/assigned": "Fires when a product is assigned to a category in the specified channel's category tree. The corresponding endpoint is Create product category assignments.",
					"store/channel/{channel_id}/category/product/unassigned": "Fires when a product is removed from a category in the specified channel's category tree. The corresponding endpoint is Delete product category assignments."
				},
				routes: {
					"store/channel/{channel_id}/settings/route/updated": "Fires on update of any route associated with the specified channel. The corresponding endpoint is Update a site's routes or Update a site route."
				},
				"scripts": {
					"store/channel/{channel_id}/script/created": "Fires on creation of any script associated with the specified channel. The corresponding endpoint is Create a script.",
					"store/channel/{channel_id}/script/updated": "Fires on update of any script associated with the specified channel. The corresponding endpoint is Update a script."
				},
				settings: {
					"store/channel/{channel_id}/settings/*": "Fires when subscribed to all settings updates for the specified channel.",
					"store/channel/{channel_id}/settings/currency/updated": "Fires when currency associated with the specified channel is updated.",
					"store/channel/{channel_id}/settings/profile/updated": "Fires when any of the global store profile settings are updated. Fires for both channel-specific profile settings changes and for changes to any global defaults that the specified channel inherits. The corresponding endpoint is Update store profile settings.",
					"store/channel/{channel_id}/settings/locale/added": "Fires when a locale is added to any channel. The corresponding endpoint is Add a locale.",
					"store/channel/{channel_id}/settings/locale/updated": "Fires when a locale is updated for any channel. The corresponding endpoint is Update a locale.",
					"store/channel/{channel_id}/settings/locale/deleted": "Fires when a locale is deleted from any channel. The corresponding endpoint is Delete a locale.",
					"store/channel/{channel_id}/settings/logo/updated": "Fires when any of the global logo settings are updated. The corresponding endpoint is Update store logo settings.",
					"store/channel/{channel_id}/settings/logo/image/updated": "Fires when any of the logo image settings that apply to the specified channel are updated.",
					"store/channel/{channel_id}/settings/favicon/image/updated": "Fires when any of the favicon image settings that apply to the specified channel are updated.",
					"store/channel/{channel_id}/settings/checkout/updated": "Fires when checkout settings that affect a specified channel are updated. The corresponding endpoint is Update channel cart settings.",
					"store/channel/{channel_id}/settings/SEO/updated": "Fires when SEO settings that affect the specified channel are updated. The corresponding endpoint is Update storefront SEO settings.",
					"store/channel/{channel_id}/settings/robots/updated": "Fires when search engine robot settings that affect the specified channel are updated. The corresponding endpoint is Update robots.txt settings.",
					"store/channel/{channel_id}/settings/category/updated": "Fires when category settings that affect the specified channel are updated. The corresponding endpoint is Update storefront category settings.",
					"store/channel/{channel_id}/settings/product/updated": "Fires when product settings that affect the specified channel are updated. The corresponding endpoint is Update storefront product settings.",
					"store/channel/{channel_id}/settings/catalog/updated": "Fires when catalog settings that affect the specified channel are updated. The corresponding endpoint is Update catalog settings.",
					"store/channel/{channel_id}/settings/security/updated": "Fires when security settings that affect the specified channel are updated. The corresponding endpoint is Update storefront security settings .",
					"store/channel/{channel_id}/settings/searchContextFilters/updated": "Fires when search context filters that affect the specified channel are updated. The corresponding endpoint is Upsert Contextual Filters.",
					"store/channel/{channel_id}/settings/defaultCustomerGroup/updated": "Fires when the default customer group associated with the specified channel is updated. The corresponding endpoint is Update a customer group.",
					"store/channel/{channel_id}/settings/customerPrivacy/updated": "Fires when customer privacy settings that affect the specified channel are updated. The corresponding endpoint is Update customer settings per channel."
				},
				sites: {
					"store/channel/{channel_id}/settings/site/updated": "Fires when a site associated with the specified channel is updated, created, or deleted. The corresponding endpoint is Update a channel site, Update a site, Create a channel site, Create a site, Delete a channel site, or Delete a site.",
					"store/channel/{channel_id}/settings/site/checkoutUrl/updated": "Fires when checkout domain per channel is updated. The corresponding endpoint is Upsert a site's checkout URL.",
					"store/channel/{channel_id}/settings/site/checkoutUrl/deleted": "Fires when checkout domain per channel is deleted. The corresponding endpoint is Delete a site's checkout URL."
				},
				"social-media-links": {
					"store/channel/{channel_id}/socialMediaLinks/updated": "Fires when a social media link associated with the specified channel is updated."
				},
				themes: {
					"store/channel/{channel_id}/theme/configuration/created": "Fires when a theme associated with the specified channel is created.",
					"store/channel/{channel_id}/theme/configuration/activated": "Fires when a theme associated with the specified channel is published."
				}
			}),
		],
	};

	methods = {
		loadOptions: {
			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('bigcommerceApi');
				if (!credentials) {
					throw new NodeOperationError(
						this.getNode(),
						'BigCommerce API credentials are required to fetch channels.',
					);
				}
				const request = {
					url: `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3/channels`,
					method: 'GET',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						'X-Auth-Token': credentials.token,
					},
					body: {},
				} as IHttpRequestOptions;
				const response = await this.helpers.httpRequest(request);

				const channels = [...response?.data];
				if (response.pagination?.total_pages > 1) {
					for (let i = 2; i <= response.pagination.total_pages; i++) {
						request.url = `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3/channels?page=${i}`;
						const nextPageResponse = await this.helpers.httpRequest(request);
						channels.push(...nextPageResponse?.data);
					}
				}

				return [
					{ name: '--GLOBAL ONLY--', value: -1 },
					...channels.map((channel: any): INodePropertyOptions => {
						return {
							name: channel.name as string,
							value: channel.id as string,
						} as INodePropertyOptions;
					}),
				];
			},
		},
	};

	webhookMethods = {
		// Webhook Setup Names Only
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				const credentials = await this.getCredentials('bigcommerceApi');
				console.log(`Checking Credentials ${credentials}`);

				const targetChannel = this.getNodeParameter('setStoreChannel', -1) as number;
				const useParameters = `listenFor_${targetChannel > 0 ? "channel" : "global"}`;
				const eventProperties = Object.keys(this.getNode().parameters).filter(p=>p.startsWith(useParameters))

				const listenFor = eventProperties
					.flatMap((p) => this.getNodeParameter(p, []) as string[])
					.filter(s=>s)
					.map((s) => s.replace("{channel_id}", String(targetChannel)))
				;
				console.log(`Listening for events: ${listenFor.join(', ')}`);

				const checkWebhookRequest = {
					url: `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3/hooks${(()=>{
						try {
							const temp = querystring.stringify({
								destination: webhookUrl
							});
							return temp ? `?${temp}` : '';
						} catch (_){return undefined}})() || ""}`,
					method: 'GET',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						'X-Auth-Token': credentials.token,
					}
				} as IHttpRequestOptions;
				console.log("Requesting existing webhooks with: ", checkWebhookRequest);

				const response = (await this.helpers.httpRequest(checkWebhookRequest));

				console.log(`Existing webhooks: ${JSON.stringify(response)}`);

				const existingHooks: Record<string, IDataObject> = {}

				for (const webhook of response.data) {
					if (listenFor.includes(webhook.scope)) {
						existingHooks[webhook.scope] = webhook;
					} else {
						const purgeRequest = {
							url: `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3/hooks/${webhook.id}`,
							method: 'DELETE',
							headers: {
								Accept: 'application/json',
								'Content-Type': 'application/json',
								'X-Auth-Token': credentials.token,
							},
							json: true,
						} as IHttpRequestOptions;

						await this.helpers.httpRequest(purgeRequest);
					}
				}

				webhookData.bcHooks = existingHooks;

				for (const event of listenFor) {
					if (!existingHooks[event]?.is_active) {
						return false;
					}
				}
				return true;
			},

			// executes if the above returns false
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				const credentials = await this.getCredentials('bigcommerceApi');

				const targetChannel = this.getNodeParameter('setStoreChannel', -1) as number;
				const useParameters = `listenFor_${targetChannel > 0 ? "channel" : "global"}`;
				const eventProperties = Object.keys(this.getNode().parameters).filter(p=>p.startsWith(useParameters))

				const listenFor = eventProperties
					.flatMap((p) => this.getNodeParameter(p, []) as string[])
					.filter(s=>s)
					.map((s) => s.replace("{channel_id}", String(targetChannel)))
				;

				const { bcHooks } = webhookData as { bcHooks: Record<string, IDataObject> };

				for (const event of listenFor) {
					const registerHookRequest = {
						url: `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3/hooks`,
						method: 'POST',
						headers: {
							Accept: 'application/json',
							'Content-Type': 'application/json',
							'X-Auth-Token': credentials.token,
						},
						json: true,
						body: {
							scope: event,
							destination: webhookUrl,
							is_active: true,
							headers: {}
						}
					} as IHttpRequestOptions;

					if (!bcHooks[event]) {
						const { data } = (await this.helpers.httpRequest(registerHookRequest));
						bcHooks[event] = data;
						console.log(`Created BigCommerce webhook: ${JSON.stringify(data)}`);
					} else if (!bcHooks[event].is_active) {
						registerHookRequest.url = registerHookRequest.url + `/${bcHooks[event].id}`;
						registerHookRequest.method = "PUT";
						const { data } = (await this.helpers.httpRequest(registerHookRequest));
						bcHooks[event] = data;
					}
				}
				return true;
			},

			// executes when deactivated or n8n is shutdown
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const credentials = await this.getCredentials('bigcommerceApi');

				const { bcHooks } = webhookData as { bcHooks: Record<string, IDataObject> };

				for (const bcHook of Object.values(bcHooks)) {
					try {
						const deleteHookRequest = {
							url: `https://api.bigcommerce.com/stores/${credentials.storeHash}/v3/hooks/${bcHook.id}`,
							method: 'DELETE',
							headers: {
								Accept: 'application/json',
								'Content-Type': 'application/json',
								'X-Auth-Token': credentials.token,
							},
							json: true,
						} as IHttpRequestOptions;

						const { data } = (await this.helpers.httpRequest(deleteHookRequest));
						console.log(`Deleted BigCommerce webhook: ${JSON.stringify(data)}`);
					} catch (error) {
						console.error(`Could not delete bc webhook: ${bcHook.id}: ${error}`);
						return false;
					}
				}

				delete webhookData.bcHooks;
				return true;
			},
		}
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return {
			workflowData: [this.helpers.returnJsonArray(this.getRequestObject().body)],
		};
	}
}
