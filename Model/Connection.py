import sqlite3


class Connection:
    def __init__(self, name_db='music.db'):
        self.name_db = name_db
        pass

    def execute(self, sql):
        con = sqlite3.connect(self.name_db)
        cursor = con.cursor()
        data = {}
        cursor.execute(sql)
        if sql[0] == "S":
            return cursor.fetchall()
        else:
            con.commit()
            data = con.total_changes
            con.close()
        return data
