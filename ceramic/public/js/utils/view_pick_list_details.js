pickListItem = Class.extend({
	init: function (opts) {
		$.extend(this, opts);
		this.setup();
	},

	setup: function(){
		this.item_locations_data = []
		this.make_dialog();
	},
	
	make_dialog: function(){
		let me = this;
		this.data = [];

		let fields = 
		[
			{
				label: __('Item Code'),
				fieldtype:'Link',
				fieldname: 'item_code',
				options: 'Item',
				read_only: 1,
				reqd: 1,
				default: me.item_code,
			},
			{
				label: __('Customer'),
				fieldtype:'Link',
				options:'Customer',
				fieldname: 'customer',
				read_only: 1,
				reqd: 1,
				default: me.customer,
			},
			{
				label: __('Idx'),
				fieldtype:'Int',
				fieldname: 'idx',
				read_only: 1,
				reqd: 1,
				hidden: 1,
				default: me.idx,
			},
			
			

			{fieldtype:'Column Break'},

			{
				label: __('Sales Order'),
				fieldtype:'Link',
				fieldname: 'sales_order',
				options: 'Sales Order',
				reqd: 1,
				read_only: 1,
				default: me.sales_order
			},
			{
				label: __('Sales Order Item'),
				fieldtype:'Data',
				fieldname: 'sales_order_item',
				reqd: 0,
				read_only: 1,
				hidden: 1,
				default: me.sales_order_item
			},
			{ fieldtype: 'Section Break', label: __('Quantity') },
			{
				label: __('Sales Order Qty'),
				fieldtype:'Float',
				fieldname: 'qty',
				reqd: 0,
				default: me.qty,
			},
			{fieldtype:'Column Break'},
			{
				label: __('Sales Order Real Qty'),
				fieldtype:'Float',
				fieldname: 'real_qty',
				reqd: 0,
				default: me.real_qty,
			},
			{fieldtype:'Column Break'},
			{
				label: __('Picked Qty'),
				fieldtype:'Float',
				fieldname: 'picked_qty',
				default: '0',
				reqd: 0,
				read_only: 1,
				default: me.picked_qty
			},
		]

		fields = fields.concat(this.get_item_fields());

		me.dialog = new frappe.ui.Dialog({
			title: __("Add Items"),
			fields: fields,
		});

		me.dialog.set_primary_action(__("Update"), function(){
			me.values = me.dialog.get_values();

			let picked_qty = me.values.picked_qty + me.picked_qty
			let so_qty = me.values.so_qty
			if (flt(me.values.qty) >= flt(me.values.picked_qty)){
				frappe.run_serially([
					() => {
						setTimeout(function(){ me.update_pick_list(); me.dialog.hide(); }, 500);
					},
				])
			} else {
				frappe.msgprint("Picked Qty should be less than " + me.qty)
			}
		});

		let $package_wrapper = this.get_item_location_wrapper();

		$($package_wrapper).find('.grid-remove-rows .grid-delete-rows').click(function (event) {
			dialog(this);
			event.preventDefault();
			event.stopPropagation();
			return false;
	 });
		// $($package_wrapper).find('.grid-add-row').hide();

		me.dialog.show();
		let filters = {'item_code': me.item_code};
		me.get_items(filters);

		// this.bind_events();
	},
	update_available_qty_child: function(filters){
		let me = this;
		me.dialog.fields_dict.item_locations.df.data.forEach(value => {
			// value.actual_available_qty = value.available_qty
			value.available_qty = value.actual_available_qty - value.picked_qty
			// item_locations.grid.df.data.push(value)
		});
		me.dialog.fields_dict.item_locations.grid.refresh();
	},
	get_items: function(filters) {
		let me = this;
		let item_locations = me.dialog.fields_dict.item_locations;
		if(!filters['item_code']){
			item_locations.grid.df.data = [];
			item_locations.grid.refresh();
			return;
		}

		filters['company'] = me.company;
		filters['to_pick_qty'] = me.remaining_to_pick

		frappe.call({
			method: "ceramic.ceramic.doc_events.pick_list.get_pick_list_so",
			freeze: true,
			args: {
				sales_order: me.sales_order,
				item_code: me.item_code,
				sales_order_item: me.sales_order_item,
				batch_no: me.batch_no
			},
			callback: function(r){
				item_locations.grid.df.data = []
				r.message.forEach(value => {
					value.actual_available_qty = value.available_qty
					value.available_qty = value.actual_available_qty - value.picked_qty
					item_locations.grid.df.data.push(value)
				});

				// item_locations.grid.df.data = r.message;
				item_locations.grid.refresh();
				// me.set_item_location_data();
			},
		});
	},
	get_item_fields: function(){
		let me = this;

		return [
			{fieldtype:'Section Break', label: __('Item Location Details')},
			{
				label: __("Item"),
				fieldname: 'item_locations',
				fieldtype: "Table",
				read_only: 0,
				fields:[
					{
						'label': 'Batch No',
						'fieldtype': 'Link',
						'fieldname': 'batch_no',
						'options': 'Batch',
						'read_only': 1,
						'in_list_view': 0,
					},
					{
						'label': 'Lot',
						'fieldtype': 'Data',
						'fieldname': 'lot_no',
						'read_only': 1,
						'in_list_view': 1,
						'columns': 2,
					},
					{
						'label': 'Picked Qty',
						'fieldtype': 'Float',
						'fieldname': 'picked_qty',
						'default':0.0,
						'read_only': 1,
						'in_list_view': 1,
						change: function(){
							me.cal_picked_qty()
							me.update_available_qty_child()
						}
					},
					{
						'label': 'Available Qty',
						'fieldtype': 'Float',
						'fieldname': 'available_qty',
						read_only: 1,
						'in_list_view': 1,
					},
					{
						'label': 'Actual Available Qty',
						'fieldtype': 'Float',
						'fieldname': 'actual_available_qty',
						read_only: 1,
						'in_list_view': 0,
						// 'hidden': 1
					},
					{
						'label': 'Actual Qty',
						'fieldtype': 'Float',
						'fieldname': 'actual_qty',
						read_only: 1,
						'in_list_view': 1,
					},
					{
						'label': 'Delivered Qty',
						'fieldtype': 'Float',
						'fieldname': 'delivered_qty',
						'read_only': 1,
						'in_list_view': 0,
					},
					{
						'label': 'Wastage Qty',
						'fieldtype': 'Float',
						'fieldname': 'wastage_qty',
						'read_only': 1,
						'in_list_view': 0,
					},
					{
						'label': 'Pick List Item',
						'fieldtype': 'Float',
						'fieldname': 'pick_list_item',
						'read_only': 0,
						'in_list_view': 0,
					},
				],
				in_place_edit: false,
				// data: this.data,
				get_data: function() {
					return this.data;
				},
			}
		];
	},
	cal_picked_qty: function(){
		let me = this;

		let selected_item_locations = me.dialog.fields_dict.item_locations.df.data;
		let picked_qty = frappe.utils.sum((selected_item_locations || []).map(row => row.picked_qty));
		me.dialog.set_value('picked_qty', picked_qty);
	},
	set_item_location_data: function(){
		let me = this;
		me.item_locations_data = me.dialog.get_value('item_locations');
	},
	bind_events: function($wrapper) {
		let me = this;

		let $item_location_wrapper = me.get_item_location_wrapper();

		$item_location_wrapper.on('click', '.grid-row-check:checkbox', (e) => {
			me.cal_picked_qty();
		})

	},
	get_item_location_wrapper: function(){
		let me = this;
		return me.dialog.get_field('item_locations').$wrapper;
	},
	get_selected_item_locations: function() {
		let me = this;
		let selected_item_locations = [];
		let $item_location_wrapper = this.get_item_location_wrapper();
		let item_locations = me.dialog.get_value('item_locations');

		$.each($item_location_wrapper.find('.form-grid > .grid-body > .rows > .grid-row'), function (idx, row) {
			var pkg = $(row).find('.grid-row-check:checkbox');

			let item_location = item_locations[idx];
			
			if($(pkg).is(':checked')){
				selected_item_locations.push(item_location);
				item_location.__checked = 1;
			} else {
				item_location.__checked = 0;
			}
		});

		return selected_item_locations;
	},
	set_item_qty: function() {
		let me = this;
		let selected_item_locations = [];
		let $item_location_wrapper = this.get_item_location_wrapper();
		let item_locations = me.dialog.get_value('item_locations');
		let remaining_to_pick = me.dialog.get_value('remaining_to_pick');

		$.each($item_location_wrapper.find('.form-grid > .grid-body > .rows > .grid-row'), function (idx, row) {
			var pkg = $(row).find('.grid-row-check:checkbox');

			let item_location = item_locations[idx];
			
			if($(pkg).is(':checked')){
				selected_item_locations.push(item_location);
				item_location.__checked = 1;
			} else {
				item_location.__checked = 0;
				item_location.to_pick_qty = Math.min((remaining_to_pick || 0), (item_location.available_qty || 0))
			}
		});
		let item_locations2 = me.dialog.fields_dict.item_locations;
		item_locations2.grid.refresh();

		// return selected_item_locations;
	},
	update_pick_list: function () {
		let me = this;
		
		let trans_items = []
		frappe.run_serially([
			() => {
				frappe.model.set_value(me.doctype, me.name, 'qty', me.values.qty);
				frappe.model.set_value(me.doctype, me.name, 'real_qty', me.values.real_qty); 
				me.frm.refresh_field('sales_order_item')
				$.each(me.frm.doc["sales_order_item"] || [], function(i, d) {
					trans_items.push({
						'item_code': d.item,
						'rate':d.rate,
						'discounted_rate': d.discounted_rate,
						'name':d.sales_order_item,
						'docname':d.sales_order_item,
						'idx':d.idx,
						'real_qty':d.real_qty + d.delivered_real_qty,
						'qty':d.qty + d.delivered_qty + d.wastage_qty
					})
				});
			},
			() => {
				frappe.call({
					method: 'ceramic.update_item.update_child_qty_rate',
					args: {
						parent_doctype: "Sales Order",
						trans_items: trans_items,
						parent_doctype_name: me.frm.doc.sales_order,
					},
					callback: function(r){
						let items = []
						me.dialog.fields_dict.item_locations.df.data.forEach(function(row, int){
							items.push({
								picked_qty: flt(flt(row.picked_qty) + flt(row.waste_qty) + flt(row.delivered_qty)),
								pick_list_item: row.pick_list_item
							})
						})
						frappe.call({
							method: 'ceramic.ceramic.doc_events.pick_list.update_pick_list',
							freeze: true,
							args: {
								items: items
							},
							callback: function(r){
								me.frm.trigger('update_items')
							}
						})
					}
				});
			},
		]);
	},
});