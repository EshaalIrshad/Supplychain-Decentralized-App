from app import create_app, db
from app.models import User, ProductMetadata, TransactionLog, Document

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db':              db,
        'User':            User,
        'ProductMetadata': ProductMetadata,
        'TransactionLog':  TransactionLog,
        'Document':        Document,
    }

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
