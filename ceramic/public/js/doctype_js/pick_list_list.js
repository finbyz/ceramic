frappe.listview_settings['Pick List'] = {
	get_indicator: function(doc) {
        if (doc.docstatus == 1){
            if (doc.status === 'Delivered'){
                return [__("Delivered"), "green", "status,=,Delivered"];
            }
            else{
                return [__("To Deliver"), "blue", "status,=,To Deliver"];
            }
        }
	}
};