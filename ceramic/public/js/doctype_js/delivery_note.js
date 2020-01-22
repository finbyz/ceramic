frappe.ui.form.on('Delivery Note', {
	refresh: function(frm) {
		// frm.trigger('si_menu_hide');
	},
    onload_post_render: function(frm){
		frm.trigger('si_menu_hide');
	},
	on_submit: function(frm){
		frm.trigger('si_menu_hide');
	},
	si_menu_hide: function(frm){
		
		let $group = cur_frm.page.get_inner_group_button("Create");
				
		let li_length = $group.find("ul li");
		for (let i = 0; i < li_length.length -1; i++) {		
			var li = $group.find(".dropdown-menu").children("li")[i];
			if (li.getElementsByTagName("a")[0].innerHTML == "Sales Invoice")
				$group.find(".dropdown-menu").children("li")[i].remove();
		}
		
		if (!frm.doc.__islocal && frm.doc.docstatus == 1 && frm.doc.status != 'Cancelled') {
			frm.add_custom_button(__("Sales Invoice"), function () {
				frappe.model.open_mapped_doc({
					method: "ceramic.ceramic.doc_events.delivery_notes.create_invoice",
                    frm: cur_frm
				})
			},
			__("Create"));
			frm.add_custom_button(__("Sales Invoice Test"), function () {
				frappe.model.open_mapped_doc({
					method: "erpnext.stock.doctype.delivery_note.delivery_note.make_sales_invoice",
					frm: cur_frm
				})
			},
			__("Create"));
		}
	}
});