// Copyright (c) 2020, Finbyz and contributors
// For license information, please see license.txt

frappe.ui.form.on('Unlink Payment Entries', {
	// refresh: function(frm) {

	// }
	party: function(frm){
		frm.doc.invoices.length = 0
		frm.refresh_fields()
	},
	primary_customer: function(frm){
		frm.doc.invoices.length = 0
		frm.refresh_fields()
	},
	get_entries: function(frm){
		frm.doc.invoices.length = 0
		frm.refresh_fields()
		if (frm.doc.invoices.length == 0 || frm.doc.invoices == undefined)
		{
			frappe.call({
				method: 'ceramic.ceramic.doctype.unlink_payment_entries.unlink_payment_entries.get_invoices_detail',
				args: {
					"company": frm.doc.company,
					"party_type": frm.doc.party_type,
					"from_date": frm.doc.from_date,
					"to_date": frm.doc.to_date,
					"party": frm.doc.party,
					"primary_customer": frm.doc.primary_customer
				},
				callback: function(r, rt){
					if (r.message){
						$.each(r.message, function(i, d) {
							var c = frm.add_child("invoices");
							c.invoice_type = d.voucher_type,
							c.invoice_number = d.voucher_no,
							c.invoice_date = d.posting_date,
							c.amount = d.grand_total,
							c.party = d.party
							c.party_type = frm.doc.party_type
						})
						frm.refresh_fields()
					}
				}
			});	
		}
		frm.refresh_fields()
	},
	unlink_entries: function(frm){
		if (frm.doc.invoices){
			$.each(frm.doc.invoices, function(i, d)
			{
				frappe.call(({
					method: 'ceramic.ceramic.doctype.unlink_payment_entries.unlink_payment_entries.unlink_all_invoices',
					args:{
						"company":frm.doc.company,
						"invoice_type":d.invoice_type,
						"invoice_number":d.invoice_number,
						"grand_total":d.amount,
						"party_type":frm.doc.party_type,
						"party": d.party
					},
					callback: function(r, rt){
						if (r.message){
							//frappe.msgprint(r.message)
						}
					}
				}))
			})
		}
	}
});
