use anyhow::Result;
use rustbreak::{DeSerError, DeSerResult, DeSerializer, PathDatabase};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::borrow::Borrow;
use std::collections::HashMap;
use std::hash::Hash;
use std::io::Read;
use std::ops::Deref;
use std::path::Path;
use std::sync::RwLockReadGuard;

#[derive(Serialize, Deserialize)]
pub struct Keyed<K, V> {
    #[serde(rename = "_id")]
    pub key: K,
    #[serde(flatten)]
    pub value: V,
}

#[derive(Default, Clone)]
pub struct Json;

impl<K, V> DeSerializer<HashMap<K, V>> for Json
where
    K: Serialize + DeserializeOwned + Hash + Eq,
    V: Serialize + DeserializeOwned,
{
    fn serialize(&self, val: &HashMap<K, V>) -> DeSerResult<Vec<u8>> {
        let mut vec = Vec::new();
        for (key, value) in val {
            let keyed = Keyed { key, value };
            serde_json::to_writer(&mut vec, &keyed).map_err(|e| DeSerError::Other(e.into()))?;
            vec.push(b'\n');
        }
        Ok(vec)
    }
    fn deserialize<R: Read>(&self, mut s: R) -> DeSerResult<HashMap<K, V>> {
        (|| {
            let mut vec = Vec::new();
            loop {
                let mut deserializer = serde_json::Deserializer::from_reader(&mut s);
                let item: Keyed<K, V> = match Deserialize::deserialize(&mut deserializer) {
                    Ok(v) => v,
                    Err(err) => {
                        if err.is_eof() && err.line() == 1 && err.column() == 0 {
                            break;
                        }
                        return Err(err.into());
                    }
                };
                vec.push((item.key, item.value));

                let mut linebreak = [0];
                s.read_exact(&mut linebreak)?;
                if linebreak[0] != b'\n' {
                    anyhow::bail!("expected linebreak");
                }
            }
            Ok(vec.into_iter().collect())
        })()
        .map_err(|e| DeSerError::Other(e))
    }
}

pub struct Database<K, V> {
    pub db: PathDatabase<HashMap<K, V>, Json>,
}

impl<K, V> Database<K, V>
where
    K: Serialize + DeserializeOwned + Clone + Hash + Eq + Send,
    V: Serialize + DeserializeOwned + Clone + Send,
{
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let db = PathDatabase::load_from_path_or_default(path.as_ref().into())?;
        Ok(Database { db })
    }

    pub fn iter(&self) -> Result<impl Iterator<Item = Keyed<&K, &V>>> {
        struct Iter<'a, K, V, I> {
            iter: I,
            _guard: RwLockReadGuard<'a, HashMap<K, V>>,
        }

        impl<'a, K, V, I> Iterator for Iter<'a, K, V, I>
        where
            I: Iterator<Item = (&'a K, &'a V)>,
        {
            type Item = Keyed<&'a K, &'a V>;

            fn next(&mut self) -> Option<Self::Item> {
                let (k, v) = self.iter.next()?;
                Some(Keyed { key: k, value: v })
            }
        }

        let guard = self.db.borrow_data()?;
        let lifetime_erased = unsafe { &*(&*guard as *const HashMap<K, V>) };
        let iter = lifetime_erased.iter();

        Ok(Iter {
            iter,
            _guard: guard,
        })
    }

    pub fn get<Q: ?Sized>(&self, k: &Q) -> Result<Option<impl Deref<Target = Keyed<&K, &V>>>>
    where
        K: Borrow<Q>,
        Q: Hash + Eq,
    {
        struct Wrapper<'a, K, V, D> {
            data: D,
            _guard: RwLockReadGuard<'a, HashMap<K, V>>,
        }

        impl<'a, K, V, D> Deref for Wrapper<'a, K, V, D> {
            type Target = D;
            fn deref(&self) -> &Self::Target {
                &self.data
            }
        }

        let guard = self.db.borrow_data()?;
        let lifetime_erased = unsafe { &*(&*guard as *const HashMap<K, V>) };
        let (key, value) = match lifetime_erased.get_key_value(k) {
            Some(v) => v,
            None => return Ok(None),
        };

        Ok(Some(Wrapper {
            data: Keyed { key, value },
            _guard: guard,
        }))
    }
}
