import frappe
from frappe import _
from frappe.utils import cint, flt, formatdate, format_time, floor
from erpnext.stock.stock_ledger import get_previous_sle, NegativeStockError
from erpnext.stock.doctype.pick_list.pick_list import get_available_item_locations_for_batched_item


def raise_exceptions(self):
	deficiency = min(e["diff"] for e in self.exceptions)

	if ((self.exceptions[0]["voucher_type"], self.exceptions[0]["voucher_no"]) in
		frappe.local.flags.currently_saving):

		msg = _("{0} units of {1} needed in {2} to complete this transaction.").format(
			abs(deficiency), frappe.get_desk_link('Item', self.item_code),
			frappe.get_desk_link('Warehouse', self.warehouse))
	else:
		msg = _("{0} units of {1} needed in {2} on {3} {4} for {5} to complete this transaction.").format(
			abs(deficiency), frappe.get_desk_link('Item', self.item_code),
			frappe.get_desk_link('Warehouse', self.warehouse),
			self.exceptions[0]["posting_date"], self.exceptions[0]["posting_time"],
			frappe.get_desk_link(self.exceptions[0]["voucher_type"], self.exceptions[0]["voucher_no"]))

	allow_negative_stock = frappe.db.get_value("Company", self.company, "allow_negative_stock")
	
	if not allow_negative_stock:
		if self.verbose:
			frappe.throw(msg, NegativeStockError, title='Insufficent Stock')
		else:
			raise NegativeStockError(msg)

def set_actual_qty(self):
	allow_negative_stock = cint(frappe.db.get_value("Stock Settings", None, "allow_negative_stock")) or cint(frappe.db.get_value("Company", self.company, "allow_negative_stock"))

	for d in self.get('items'):
		previous_sle = get_previous_sle({
			"item_code": d.item_code,
			"warehouse": d.s_warehouse or d.t_warehouse,
			"posting_date": self.posting_date,
			"posting_time": self.posting_time
		})

		# get actual stock at source warehouse
		d.actual_qty = previous_sle.get("qty_after_transaction") or 0

		# validate qty during submit
		if d.docstatus==1 and d.s_warehouse and not allow_negative_stock and flt(d.actual_qty, d.precision("actual_qty")) < flt(d.transfer_qty, d.precision("actual_qty")):
			frappe.throw(_("Row {0}: Quantity not available for {4} in warehouse {1} at posting time of the entry ({2} {3})").format(d.idx,
				frappe.bold(d.s_warehouse), formatdate(self.posting_date),
				format_time(self.posting_time), frappe.bold(d.item_code))
				+ '<br><br>' + _("Available quantity is {0}, you need {1}").format(frappe.bold(d.actual_qty),
					frappe.bold(d.transfer_qty)),
				NegativeStockError, title=_('Insufficient Stock'))

def get_available_item_locations(item_code, from_warehouses, required_qty):
	locations = []
	if frappe.get_cached_value('Item', item_code, 'has_serial_no'):
		locations = get_available_item_locations_for_serialized_item(item_code, from_warehouses, required_qty)
	elif frappe.get_cached_value('Item', item_code, 'has_batch_no'):
		locations = get_available_item_locations_for_batched_item(item_code, from_warehouses, required_qty)
	else:
		locations = get_available_item_locations_for_other_item(item_code, from_warehouses, required_qty)

	total_qty_available = sum(location.get('qty') for location in locations)

	remaining_qty = required_qty - total_qty_available

	if remaining_qty > 0:
		frappe.msgprint(_('{0} units of {1} is not available.')
			.format(remaining_qty, frappe.get_desk_link('Item', item_code)))

	return locations

def get_items_with_location_and_quantity(item_doc, item_location_map):
	available_locations = item_location_map.get(item_doc.item_code)
	locations = []

	remaining_stock_qty = item_doc.stock_qty
	while remaining_stock_qty > 0 and available_locations:
		item_location = available_locations.pop(0)
		item_location = frappe._dict(item_location)

		stock_qty = remaining_stock_qty if item_location.qty >= remaining_stock_qty else item_location.qty
		qty = stock_qty / (item_doc.conversion_factor or 1)

		uom_must_be_whole_number = frappe.db.get_value('UOM', item_doc.uom, 'must_be_whole_number')
		if uom_must_be_whole_number:
			qty = floor(qty)
			stock_qty = qty * item_doc.conversion_factor
			if not stock_qty: break

		serial_nos = None
		if item_location.serial_no:
			serial_nos = '\n'.join(item_location.serial_no[0: cint(stock_qty)])

		locations.append(frappe._dict({
			'qty': qty,
			'stock_qty': stock_qty,
			'warehouse': item_location.warehouse,
			'serial_no': serial_nos,
			'batch_no': item_location.batch_no
		}))

		remaining_stock_qty -= stock_qty

		qty_diff = item_location.qty - stock_qty
		# if extra quantity is available push current warehouse to available locations
		if qty_diff > 0:
			item_location.qty = qty_diff
			if item_location.serial_no:
				# set remaining serial numbers
				item_location.serial_no = item_location.serial_no[-qty_diff:]
			available_locations = [item_location] + available_locations

	# update available locations for the item
	item_location_map[item_doc.item_code] = available_locations
	return locations

def set_item_locations(self):
	items = self.aggregate_item_qty()
	self.item_location_map = frappe._dict()

	from_warehouses = None
	if self.parent_warehouse:
		from_warehouses = frappe.db.get_descendants('Warehouse', self.parent_warehouse)

	# reset
	self.delete_key('locations')
	for item_doc in items:
		item_code = item_doc.item_code

		self.item_location_map.setdefault(item_code,
			get_available_item_locations(item_code, from_warehouses, self.item_count_map.get(item_code)))

		locations = get_items_with_location_and_quantity(item_doc, self.item_location_map)

		item_doc.idx = None
		item_doc.name = None

		for row in locations:
			row.update({
				'picked_qty': row.stock_qty
			})

			location = item_doc.as_dict()
			location.update(row)
			self.append('locations', location)

def set_item_locations(self):
	pass