
/**
 * Represents a filter button in the Impact Hub
 * NOTE: Does not extend DataClass as it is not an independent object, it is held as a list in Campaign
 */
class FilterButton {
	constructor () {
		this.query = "";
		this.displayName = "";
		this.imgUrl = "";
	}
}

export default FilterButton;
