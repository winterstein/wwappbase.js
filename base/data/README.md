
Data model classes -- are really sets of utility functions.
They are all singletons!
The state is always held in vanilla json objects.
The data model class provides a class-like coding pattern.

E.g.

let myngo = {"name": "Save the Kittens"}

assert( NGO.getName(myngo) === 'Save the Kittens' );
