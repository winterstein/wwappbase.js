
import DataClass from './DataClass';

/**
 * Based on https://schema.org/ImageObject (but not identical - eg uses `id`)
 */
class ImageObject extends DataClass {
	name;
	author;
	/** url for a source page */
	url;
	/** the actual image url */
	contentUrl;
	license;
}
DataClass.register(ImageObject, "ImageObject");
const This = ImageObject;
export default ImageObject;

