import frappe
from frappe import _
from frappe.model.mapper import get_mapped_doc
from frappe.contacts.doctype.address.address import get_company_address

def get_returned_qty_map(delivery_note):
    """returns a map: {so_detail: returned_qty}"""
    returned_qty_map = frappe._dict(frappe.db.sql("""select dn_item.item_code, sum(abs(dn_item.qty)) as qty
        from `tabDelivery Note Item` dn_item, `tabDelivery Note` dn
        where dn.name = dn_item.parent
            and dn.docstatus = 1
            and dn.is_return = 1
            and dn.return_against = %s
        group by dn_item.item_code
    """, delivery_note))

    return returned_qty_map

def get_invoiced_qty_map(delivery_note):
    """returns a map: {dn_detail: invoiced_qty}"""
    invoiced_qty_map = {}

    for dn_detail, qty in frappe.db.sql("""select dn_detail, qty from `tabSales Invoice Item`
        where delivery_note=%s and docstatus=1""", delivery_note):
            if not invoiced_qty_map.get(dn_detail):
                invoiced_qty_map[dn_detail] = 0
            invoiced_qty_map[dn_detail] += qty

    return invoiced_qty_map

@frappe.whitelist()
def create_invoice(source_name, target_doc=None):
    doc = frappe.get_doc('Delivery Note', source_name)

    to_make_invoice_qty_map = {}
    returned_qty_map = get_returned_qty_map(source_name)
    invoiced_qty_map = get_invoiced_qty_map(source_name)

    

    def set_missing_values(source, target):
        target.is_pos = 0
        target.ignore_pricing_rule = 1
        target.run_method("set_missing_values")
        target.run_method("set_po_nos")
        alternate_company = frappe.db.get_value("Company", source.company, "alternate_company")
        target.expense_account = ""
        # target_doc.delivery_note = "T"

        if alternate_company:
            target.company = alternate_company

        if len(target.get("items")) == 0:
            frappe.throw(_("All these items have already been invoiced"))

        target.run_method("calculate_taxes_and_totals")

        # set company address
        if source.company_address:
            target.update({'company_address': source.company_address})
        else:
            # set company address
            target.update(get_company_address(target.company))

        if target.company_address:
            target.update(get_fetch_values("Sales Invoice", 'company_address', target.company_address))

    def update_item(source_doc, target_doc, source_parent):
        target_doc.qty = to_make_invoice_qty_map[source_doc.name]

        if source_doc.serial_no and source_parent.per_billed > 0:
            target_doc.serial_no = get_delivery_note_serial_no(source_doc.item_code,
                target_doc.qty, source_parent.name)

    def get_pending_qty(item_row):
        pending_qty = item_row.qty - invoiced_qty_map.get(item_row.name, 0)

        returned_qty = 0
        if returned_qty_map.get(item_row.item_code, 0) > 0:
            returned_qty = flt(returned_qty_map.get(item_row.item_code, 0))
            returned_qty_map[item_row.item_code] -= pending_qty

        if returned_qty:
            if returned_qty >= pending_qty:
                pending_qty = 0
                returned_qty -= pending_qty
            else:
                pending_qty -= returned_qty
                returned_qty = 0

        to_make_invoice_qty_map[item_row.name] = pending_qty

        return pending_qty

    doc = get_mapped_doc("Delivery Note", source_name, {
        "Delivery Note": {
            "doctype": "Sales Invoice",
            "field_map": {
                "is_return": "is_return"
            },
            "validation": {
                "docstatus": ["=", 1]
            }
        },
        "Delivery Note Item": {
            "doctype": "Sales Invoice Item",
            "field_map": {
                "parent": "delivery_docname",
                "so_detail": "delivery_docdetails",
                "against_sales_order": "sales_order",
                "serial_no": "serial_no",
                "cost_center": "cost_center",
                "real_qty": "qty",
                "discounted_rate": "rate",
            },
            "field_no_map": [
				"income_account",
				"expense_account",
				"cost_center",
				"warehouse"
			],
            "postprocess": update_item,
            "filter": lambda d: get_pending_qty(d) <= 0 if not doc.get("is_return") else get_pending_qty(d) > 0
        },
        # "Sales Taxes and Charges": {
        # 	"doctype": "Sales Taxes and Charges",
        # 	"add_if_empty": True
        # },
        "Sales Team": {
            "doctype": "Sales Team",
            "field_map": {
                "incentives": "incentives"
            },
            "add_if_empty": True
        }
    }, target_doc, set_missing_values)

    return doc

